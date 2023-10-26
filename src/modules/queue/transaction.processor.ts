import { BigNumber } from 'ethers';
import { TxManager } from '@tornado/tx-manager';
import { Job, Queue, DoneCallback } from 'bull';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';

import { MembershipProof, Transaction } from '@/types';
import { getToIntegerMultiplier, toWei } from '@/utilities';
import { CONTRACT_ERRORS, SERVICE_ERRORS, jobStatus } from '@/constants';
import { GasPriceService, ProviderService } from '@/services';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PinataClient = require('@pinata/sdk');

import txManagerConfig from '@/config/txManager.config';

import { BaseProcessor } from './base.processor';

@Injectable()
@Processor('transaction')
export class TransactionProcessor extends BaseProcessor<Transaction> {
  public pinataClient: any;
  constructor(
    @InjectQueue('transaction') public transactionQueue: Queue,
    private configService: ConfigService,
    private gasPriceService: GasPriceService,
    private providerService: ProviderService,
  ) {
    super();
    this.queueName = 'transaction';
    this.queue = transactionQueue;
    this.pinataClient = new PinataClient(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);
  }

  @Process()
  async processTransactions(job: Job<Transaction>, cb: DoneCallback) {
    try {
      const { extData, membershipProof } = job.data;
      console.log('extData:', extData);
      console.log('membershipProof:', membershipProof);
      await this.checkFee({ fee: extData.fee, externalAmount: extData.extAmount });
      console.log('check fee done');
      await this.checkProof(membershipProof);
      console.log('check proof done');
      await this.uploadProof(membershipProof, extData);
      console.log('upload proof done');
      const txHash = await this.submitTx(job);
      console.log('submit tx done');
      console.log('txHash:', txHash);
      cb(null, txHash);
    } catch (err) {
      cb(err);
    }
  }

  @OnQueueActive()
  async onActive(job: Job) {
    job.data.status = jobStatus.ACCEPTED;
    await this.updateTask(job);
  }

  @OnQueueCompleted()
  async onCompleted(job: Job) {
    job.data.status = jobStatus.CONFIRMED;
    await this.updateTask(job);
  }

  @OnQueueFailed()
  async onFailed(job: Job) {
    job.data.status = jobStatus.FAILED;
    await this.updateTask(job);
  }

  async submitTx(job: Job<Transaction>) {
    try {
      const txManager = new TxManager(txManagerConfig());
      console.log('@@@@@@@@');
      console.log('job.data:', job.data);
      const prepareTx = await this.prepareTransaction(job.data);
      console.log('job.data:', job.data);
      const tx = await txManager.createTx(prepareTx);

      const receipt = await tx
        .send()
        .on('transactionHash', async (txHash: string) => {
          job.data.txHash = txHash;
          job.data.status = jobStatus.SENT;

          await this.updateTask(job);
        })
        .on('mined', async () => {
          job.data.status = jobStatus.MINED;

          await this.updateTask(job);
        })
        .on('confirmations', async (confirmations) => {
          job.data.confirmations = confirmations;

          await this.updateTask(job);
        });

      if (BigNumber.from(receipt.status).eq(1)) {
        return receipt.transactionHash;
      } else {
        console.log('throw new Error("Submitted transaction failed");');
        throw new Error('Submitted transaction failed');
      }
    } catch (err) {
      return this.handleError(err);
    }
  }

  async prepareTransaction({ extData, args }) {
    const contract = this.providerService.getTornadoPool();
    console.log('########');
    const data = contract.interface.encodeFunctionData('transact', [args, extData]);
    console.log('########');
    const gasLimit = this.configService.get<BigNumber>('base.gasLimit');
    console.log('########');
    const { fast } = await this.gasPriceService.getGasPrice();

    return {
      data,
      gasLimit,
      to: contract.address,
      gasPrice: fast,
      value: BigNumber.from(0)._hex,
    };
  }

  getServiceFee(externalAmount) {
    const amount = BigNumber.from(externalAmount);
    const { serviceFee } = this.configService.get('base');

    // for withdrawals the amount is negative
    if (amount.isNegative()) {
      const oneEther = getToIntegerMultiplier();

      const share = Number(serviceFee.withdrawal) / 100;
      return amount.mul(toWei(share.toString())).div(oneEther);
    }

    return serviceFee.transfer;
  }

  async checkFee({ fee, externalAmount }) {
    console.log('fee:', fee);
    try {
      const { gasLimit } = this.configService.get('base');
      const { fast } = await this.gasPriceService.getGasPrice();
      console.log('fast:', fast);

      const operationFee = BigNumber.from(fast).mul(gasLimit);
      console.log('operationFee:', operationFee);
      const feePercent = this.getServiceFee(externalAmount);
      console.log('feePercent:', feePercent);
      const expense = operationFee.div(toWei('1'));
      console.log('expense:', expense);
      const desiredFee = expense.add(feePercent);
      console.log('desiredFee:', desiredFee);
      if (BigNumber.from(fee).lt(desiredFee)) {
        console.log('throw new Error(SERVICE_ERRORS.INSUFFICIENT_FEE);');
        throw new Error(SERVICE_ERRORS.GAS_SPIKE);
      }
    } catch (err) {
      console.log('err:', err);
      this.handleError(err);
    }
  }

  handleError({ message }: Error) {
    console.log('handleError:', message);
    const contractError = CONTRACT_ERRORS.find((knownError) => message.includes(knownError));

    if (contractError) {
      throw new Error(`Revert by smart contract: ${contractError}`);
    }

    const serviceError = Object.values(SERVICE_ERRORS).find((knownError) => message.includes(knownError));

    if (serviceError) {
      throw new Error(`Relayer internal error: ${serviceError}`);
    }

    console.log('handleError:', message);

    throw new Error('Relayer did not send your transaction. Please choose a different relayer.');
  }

  //TODO: check proof
  async checkProof(proof: any) {
    try {
    } catch (err) {
      this.handleError(err);
    }
  }

  async uploadProof(proof: any, extData: any) {
    console.log('proof: ', proof);
    // console.log('process.env.PINATA_API_KEY: ', process.env.PINATA_API_KEY);
    // console.log('process.env.PINATA_SECRET_API_KEY: ', process.env.PINATA_SECRET_API_KEY);
    console.log('create pinata client done');
    try {
      const options = {
        pinataMetadata: {
          name: 'proof.json',
        },
        pinataPinOptions: {
          cidVersion: 0,
        },
      };
      console.log('prepare proof for upload done');
      const res = await this.pinataClient.pinJSONToIPFS(proof, options);
      console.log('CID: ', res);
      if (res.IpfsHash != extData.membershipProofURI) {
        console.log('throw new Error(SERVICE_ERRORS.INSUFFICIENT_FEE);');
        throw new Error(SERVICE_ERRORS.IPFS_CID_FAIL);
      }
      return res;
    } catch (err) {
      console.log('err:', err);
      this.handleError(err);
    }
  }
}

import { BigNumber } from 'ethers';
import { TxManager } from 'tx-manager';
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

// @ts-expect-error
import { poseidon } from 'circomlib'

// eslint-disable-next-line
function poseidonHash(items: any[]) {
  return BigNumber.from(poseidon(items).toString())
}
const fs = require('fs');
const publicParams = fs.readFileSync('/Users/ekrembal/Developer/chainway/poi/ProofOfInnocence/privacy-pools-v1-relayer/public/public_parameters.json', { encoding: 'utf8' });

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
      const { args, extData, membershipProof } = job.data;
      console.log('extData relayer:', extData.relayer);
      const { rewardAddress } = this.configService.get('base');

      if (extData.relayer != rewardAddress) {
        throw new Error(SERVICE_ERRORS.INVALID_RELAYER_ADDRESS);
      }
      // console.log('extData:', extData);
      // console.log('membershipProof:', membershipProof);


      await this.checkFee({ fee: extData.fee, externalAmount: extData.extAmount });
      console.log('check fee done');

      await this.checkProof(membershipProof, args.inputNullifiers);
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
      console.log('prepareTx:', prepareTx);
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
    const contract = this.providerService.getPrivacyPool();
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
      return amount.mul(toWei(share.toString())).div(oneEther).mul(-1).add(serviceFee.transfer);
    } else {
      throw "Only withdrawals are allowed";
    }

    return serviceFee.transfer;
  }

  async checkFee({ fee, externalAmount }) {
    console.log('fee:', fee);
    try {
      const { gasLimit } = this.configService.get('base');
      const { fast } = await this.gasPriceService.getGasPrice();
      console.log("Gas Limit", gasLimit);
      const operationFee = BigNumber.from(fast).mul(gasLimit);
      console.log("Operation Fee", operationFee);

      const feePercent = this.getServiceFee(externalAmount);
      console.log("Fee Percent", feePercent);

      const desiredFee = operationFee.add(feePercent);
      console.log("Desired Fee", desiredFee);
      console.log("Fee", fee);

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
  async checkProof(proof: any, nullifiers: string[]) {
    try {
      const worker = require('nova_scotia_browser');
      worker.init_panic_hook();
      let proof_json = JSON.parse(proof);
      let proof_str = proof_json["proof"];
      const ZERO_LEAF = BigNumber.from('21663839004416932945382355908790599225266501822907911457504978515578255421292')
      let accInnocentCommitments = [ZERO_LEAF, ZERO_LEAF]
      const step_in = poseidonHash([proof_json["txRecordsMerkleRoot"], proof_json["allowedTxRecordsMerkleRoot"], poseidonHash(accInnocentCommitments)])

      // TODO: check if txRecordsMerkleRoot is correct
      // TODO: check if allowedTxRecordsMerkleRoot is from the correct pool

      let start_str = JSON.stringify({ step_in: [step_in.toHexString()] });
      function bigNumberToBytes(bigNumber: BigNumber): Array<number> {
        const hexString = bigNumber.toHexString().slice(2).padStart(64, '0');
        const byteArray = [];
        for (let i = 0; i < hexString.length; i += 2) {
          byteArray.push(parseInt(hexString.slice(i, i + 2), 16));
        }
        return byteArray.reverse();
      }

      function isArraysEqual(array1: Array<number>, array2: Array<number>): boolean {
        if (array1.length !== array2.length) {
          return false;
        }
        for (let i = 0; i < array1.length; i++) {
          if (array1[i] !== array2[i]) {
            return false;
          }
        }
        return true;
      }

      let x = JSON.parse(worker.verify_compressed_proof(publicParams, proof_str, start_str));
      let expected_output = bigNumberToBytes(poseidonHash(nullifiers));
      if (!isArraysEqual(x, expected_output)){
        throw "Membership proofs nullifiers do not match."
      }
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
      const res = await this.pinataClient.pinJSONToIPFS(JSON.parse(proof), options);
      console.log('CID: ', res);
      if ("ipfs://" + res.IpfsHash != extData.membershipProofURI) {
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

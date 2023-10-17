import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BigNumber } from 'ethers';
import { GasPriceOracle } from '@tornado/gas-price-oracle';
import type { GasPrice } from '@tornado/gas-price-oracle/lib/services';

import { toWei } from '@/utilities';
import { SERVICE_ERRORS } from '@/constants';

const bump = (gas: BigNumber, percent: number) => gas.mul(percent).div(100).toHexString();
const gweiToWei = (value: number) => toWei(String(value), 'gwei');

const percentBump = {
  INSTANT: 150,
  FAST: 130,
  STANDARD: 85,
  LOW: 50,
};

@Injectable()
export class GasPriceService {
  private readonly chainId: number;
  private readonly rpcUrl: string;

  constructor(private configService: ConfigService) {
    this.chainId = this.configService.get<number>('base.chainId');
    this.rpcUrl = this.configService.get('base.rpcUrl');
  }

  async getGasPrice() {
    // try {
    //   const instance = new GasPriceOracle({
    //     chainId: this.chainId,
    //     defaultRpc: this.rpcUrl,
    //   });

    //   const result = (await instance.gasPrices({ isLegacy: true })) as GasPrice;

    return {
      //     instant: bump(gweiToWei(result.instant), percentBump.INSTANT),
      //     fast: bump(gweiToWei(result.instant), percentBump.FAST),
      //     standard: bump(gweiToWei(result.standard), percentBump.STANDARD),
      //     low: bump(gweiToWei(result.low), percentBump.LOW),
      instant: gweiToWei(50),
      fast: gweiToWei(50),
      standard: gweiToWei(50),
      low: gweiToWei(50),
    };
    //   } catch (err) {
    //     console.log('getGasPrice has error:', err.message);
    //     throw new Error(SERVICE_ERRORS.GAS_PRICE);
    //   }
  }
}

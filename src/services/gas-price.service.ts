import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BigNumber } from 'ethers';
import { GasPriceOracle } from '@tornado/gas-price-oracle';
import type { GasPrice } from '@tornado/gas-price-oracle/lib/services';

import { toWei } from '@/utilities';
import { SERVICE_ERRORS } from '@/constants';

const bump = (gas: BigNumber, percent: number) => gas.mul(percent).div(100).toHexString();

function toNonExponential(value: string) {
  const valueParts = value.split('e');
  if (valueParts.length === 1) return value; // not in exponential notation

  let [base, exponent] = valueParts;
  let exponentnum = parseInt(exponent, 10); // convert exponent to a number

  // Split the base into two parts at the decimal point
  let [integer, fraction] = base.split('.');
  if (!fraction) fraction = '';

  if (exponentnum >= 0) {
    return integer + fraction.padEnd(exponentnum, '0');
  } else {
    const fractionDigits = Math.abs(exponentnum) - integer.length;
    return '0.' + '0'.repeat(fractionDigits) + integer + fraction;
  }
}

const gweiToWei = (value: number) => toWei(toNonExponential(value.toString()), 'gwei');

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
    try {
      const instance = new GasPriceOracle({
        chainId: this.chainId,
        defaultRpc: this.rpcUrl,
      });

      const result = (await instance.gasPrices({ isLegacy: true })) as GasPrice;

      return {
        instant: bump(gweiToWei(result.instant), percentBump.INSTANT),
        fast: bump(gweiToWei(result.instant), percentBump.FAST),
        standard: bump(gweiToWei(result.standard), percentBump.STANDARD),
        low: bump(gweiToWei(result.low), percentBump.LOW),
      };
    } catch (err) {
      console.log('getGasPrice has error:', err.message);
      throw new Error(SERVICE_ERRORS.GAS_PRICE);
    }
  }
}

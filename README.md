# Relayer for Tornado Cash Nova [![Build Status](https://github.com/tornadocash/tornado-pool-relayer/workflows/build/badge.svg)](https://github.com/tornadocash/tornado-pool-relayer/actions) [![Docker Image Version (latest semver)](https://img.shields.io/docker/v/tornadocash/nova-relayer?logo=docker&logoColor=%23FFFFFF&sort=semver)](https://hub.docker.com/repository/docker/tornadocash/nova-relayer)

## Deploy with docker-compose (recommended)

_The following instructions are for Ubuntu 22.10, other operating systems may vary. These instructions include automated SSL configuration with LetsEncrypt._

**PREREQUISITES**

1. Update core dependencies

- `sudo apt-get update`

2. Install docker-compose

- `curl -SL https://github.com/docker/compose/releases/download/v2.16.0/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose`

3. Install Docker

- `curl -fsSL https://get.docker.com -o get-docker.sh && chmod +x get-docker.sh && ./get-docker.sh`

4. Install git

- `sudo apt-get install git`

5. Install node

- `sudo apt install nodejs npm`

**DEPLOYMENT**

1. Clone this repository

   `git clone https://git.tornado.ws/tornadocash/nova-relayer && cd nova-relayer`

2. Copy `.env.example` to `.env` and setup environment variables in `.env` file

   - set `CHAIN_ID` (100 for xdai, 1 for mainnet)
   - set `PRIVATE_KEY` for your relayer address (without 0x prefix)
   - set `VIRTUAL_HOST` and `LETSENCRYPT_HOST` to your domain and add DNS record pointing to your relayer ip address
   - set `REWARD_ADDRESS` - eth address that is used to collect fees
   - set `RPC_URL` rpc url for your node
   - set `ORACLE_RPC_URL` - rpc url for mainnet node for fetching prices(always have to be on mainnet)
   - set `WITHDRAWAL_SERVICE_FEE` - fee in % that is used for tornado withdrawals
   - set `TRANSFER_SERVICE_FEE` - fee is a fixed value in ether for transfer
   - set `CONFIRMATIONS` if needed - how many block confirmations to wait before processing an event. Not recommended to set less than 3
   - set `MAX_GAS_PRICE` if needed - maximum value of gwei value for relayer's transaction

3. Build and deploy the docker container:
   - `npm run build:docker`
   - `docker-compose up -d`

## Run locally

1. `yarn`
2. `cp .env.example .env`
3. Modify `.env` as needed
4. `yarn start:dev`
5. Go to `http://127.0.0.1:8000`
6. In order to execute withdraw/transfer request, you can run following command

```bash
curl -X POST -H 'content-type:application/json' --data '<input data>' http://127.0.0.1:8000/transaction
```

Relayer should return a transaction hash

In that case you will need to add https termination yourself because browsers with default settings will prevent https
tornado.cash UI from submitting your request over http connection

## Architecture

- Abi: Json ABI for working with contracts
- Artifacts: The generated file contains typed contract instances
- Config:
  1. `bull.config.ts` bull service settings
  2. `configuration.ts` global application configuration
  3. `txManager.config.ts` txManager service settings
- Constants:
  1. `contracts.ts` addresses of contracts and rps
  2. `variables.ts` various variables to make things easier
- Modules:
  1. `controller.ts` Controller file that will contain all the application routes
  2. `module.ts` The module file essentially bundles all the controllers and providers of your application together.
  3. `service.ts` The service will include methods that will perform a certain operation.
  4. `main.ts` The entry file of the application will take in your module bundle and create an app instance using the NestFactory provided by Nest.
- Services:
  1. `gas-price.ts` update gas prices
  2. `offchain-price.ts` update the exchange rate
  3. `provider.ts` add-on for working with ethers js
- Types: types for the application
- Utilities: helpers functions

Disclaimer:

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

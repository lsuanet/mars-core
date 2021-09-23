/*
Integration test for the safety fund contract swapping assets to UST via Astroport.

Required directory structure:
```
$ tree -L 1 $(git rev-parse --show-toplevel)/..
.
├── LocalTerra
├── protocol
├── terraswap
```
*/
import { Int, LocalTerra, MsgSend, Numeric, Wallet } from "@terra-money/terra.js"
import {
  deployContract,
  executeContract,
  instantiateContract,
  performTransaction,
  queryContract,
  setTimeoutDuration,
  uploadContract
} from "../helpers.js"
import { strict as assert, strictEqual } from "assert"
import { join } from "path"

// CONSTS

const ZERO = new Int(0)
const MARS_ARTIFACTS_PATH = "../artifacts"
const TERRASWAP_ARTIFACTS_PATH = "../../terraswap/artifacts"
const TOKEN_SUPPLY = 1_000_000_000_000000
const TOKEN_LP = 10_000_000_000000
const USD_LP = 1_000_000_000000
const SAFETY_FUND_TOKEN_BALANCE = 100_000_000000

// TYPES

interface NativeToken {
  native_token: {
    denom: string
  }
}

interface CW20 {
  token: {
    contract_addr: string
  }
}

type Token = NativeToken | CW20

interface Env {
  terra: LocalTerra,
  wallet: Wallet,
  tokenCodeID: number,
  pairCodeID: number,
  factoryCodeID: number,
  factoryAddress: string,
  safetyFundAddress: string,
}

// HELPERS

async function instantiateUsdPair(env: Env, bid: Token) {
  const result = await executeContract(env.terra, env.wallet, env.factoryAddress,
    {
      create_pair: {
        asset_infos: [
          bid,
          { "native_token": { "denom": "uusd" } }
        ]
      }
    }
  )
  return result.logs[0].eventsByType.wasm.pair_contract_addr[0]
}

async function provideLiquidity(env: Env, address: string, token: Token, coins: string) {
  await executeContract(env.terra, env.wallet, address,
    {
      "provide_liquidity": {
        "assets": [
          {
            "info": token,
            "amount": String(TOKEN_LP)
          }, {
            "info": { "native_token": { "denom": "uusd" } },
            "amount": String(USD_LP)
          }
        ]
      }
    },
    coins,
  )
}

async function getBalance(env: Env, address: string, denom: string): Promise<Numeric.Output> {
  const balances = await env.terra.bank.balance(address)
  const balance = balances.get(denom)
  if (balance === undefined) {
    return ZERO
  }
  return balance.amount
}

// TESTS

async function testSwapNativeTokenToUsd(env: Env, denom: string) {
  const NATIVE_TOKEN = { "native_token": { "denom": denom } }

  // instantiate a native token/USD Astroport pair
  const pairAddress = await instantiateUsdPair(env, NATIVE_TOKEN)

  await provideLiquidity(env, pairAddress, NATIVE_TOKEN, `${USD_LP}uusd,${TOKEN_LP}${denom}`)

  // transfer some native token to the safety fund
  await performTransaction(env.terra, env.wallet,
    new MsgSend(
      env.wallet.key.accAddress,
      env.safetyFundAddress,
      {
        [denom]: SAFETY_FUND_TOKEN_BALANCE
      }
    )
  )

  // cache the USD balance before swapping
  const prevUsdBalance = await getBalance(env, env.safetyFundAddress, "uusd")

  // swap the native token balance in the safety fund to USD
  await executeContract(env.terra, env.wallet, env.safetyFundAddress,
    {
      "swap_asset_to_uusd": {
        "offer_asset_info": NATIVE_TOKEN,
        "amount": String(SAFETY_FUND_TOKEN_BALANCE)
      }
    }
  )

  // check the safety fund balances
  const usdBalance = await getBalance(env, env.safetyFundAddress, "uusd")
  assert(usdBalance.gt(prevUsdBalance))
  const tokenBalance = await getBalance(env, env.safetyFundAddress, denom)
  strictEqual(tokenBalance, ZERO)

  // check the Astroport pair balances
  const pool = await queryContract(env.terra, pairAddress, { "pool": {} })
  strictEqual(pool.assets[0].amount, String(TOKEN_LP + SAFETY_FUND_TOKEN_BALANCE))
  assert(parseInt(pool.assets[1].amount) < USD_LP)
}

async function testSwapTokenToUsd(env: Env, address: string) {
  const TOKEN = { "token": { "contract_addr": address } }

  // instantiate a token/USD Astroport pair
  const pairAddress = await instantiateUsdPair(env, TOKEN)
  // approve the pair contract to transfer the token
  await executeContract(env.terra, env.wallet, address,
    {
      "increase_allowance": {
        "spender": pairAddress,
        "amount": String(TOKEN_LP),
      }
    }
  )
  await provideLiquidity(env, pairAddress, TOKEN, `${USD_LP}uusd`)

  // transfer some tokens to the safety fund
  await executeContract(env.terra, env.wallet, address,
    {
      "transfer": {
        "amount": String(SAFETY_FUND_TOKEN_BALANCE),
        "recipient": env.safetyFundAddress
      }
    }
  )

  // cache the USD balance before swapping
  const prevUsdBalance = await getBalance(env, env.safetyFundAddress, "uusd")

  // swap the token balance in the safety fund to USD
  await executeContract(env.terra, env.wallet, env.safetyFundAddress,
    {
      "swap_asset_to_uusd": {
        "offer_asset_info": TOKEN,
        "amount": String(SAFETY_FUND_TOKEN_BALANCE)
      }
    }
  )

  // check the safety fund balances
  const usdBalance = await getBalance(env, env.safetyFundAddress, "uusd")
  assert(usdBalance.gt(prevUsdBalance))
  const tokenBalance = await queryContract(env.terra, address, { "balance": { "address": env.safetyFundAddress } })
  strictEqual(tokenBalance.balance, "0")

  // check the Astroport pair balances
  const pool = await queryContract(env.terra, pairAddress, { "pool": {} })
  strictEqual(pool.assets[0].amount, String(TOKEN_LP + SAFETY_FUND_TOKEN_BALANCE))
  assert(parseInt(pool.assets[1].amount) < USD_LP)
}

// MAIN

async function main() {
  setTimeoutDuration(0)

  const terra = new LocalTerra()
  const wallet = terra.wallets.test1

  console.log("deploying Astroport contracts")
  const tokenCodeID = await uploadContract(terra, wallet, join(TERRASWAP_ARTIFACTS_PATH, "terraswap_token.wasm"))
  const pairCodeID = await uploadContract(terra, wallet, join(TERRASWAP_ARTIFACTS_PATH, "terraswap_pair.wasm"))
  const factoryCodeID = await uploadContract(terra, wallet, join(TERRASWAP_ARTIFACTS_PATH, "terraswap_factory.wasm"))
  // instantiate the factory contract without `init_hook`, so that it can be a directory of pairs
  const factoryAddress = await instantiateContract(terra, wallet, factoryCodeID,
    {
      "pair_code_id": pairCodeID,
      "token_code_id": tokenCodeID
    }
  )

  console.log("deploying Mars safety fund")
  const safetyFundAddress = await deployContract(terra, wallet, join(MARS_ARTIFACTS_PATH, "safety_fund.wasm"),
    {
      "owner": wallet.key.accAddress,
      "astroport_factory_address": factoryAddress,
      "astroport_max_spread": "0.01",
    }
  )

  console.log("deploying a token contract")
  const tokenAddress = await instantiateContract(terra, wallet, tokenCodeID,
    {
      "name": "Mars",
      "symbol": "MARS",
      "decimals": 6,
      "initial_balances": [
        {
          "address": wallet.key.accAddress,
          "amount": String(TOKEN_SUPPLY)
        }
      ]
    }
  )

  const env = {
    terra,
    wallet,
    tokenCodeID,
    pairCodeID,
    factoryCodeID,
    factoryAddress,
    safetyFundAddress,
  }

  console.log("testSwapNativeTokenToUsd")
  await testSwapNativeTokenToUsd(env, "uluna")

  console.log("testSwapTokenToUsd")
  await testSwapTokenToUsd(env, tokenAddress)

  console.log("OK")
}

main().catch(err => console.log(err));
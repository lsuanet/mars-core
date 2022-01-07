import {
  LCDClient,
  LocalTerra,
  MnemonicKey,
  Wallet
} from "@terra-money/terra.js"
import { join } from "path"
import 'dotenv/config.js'
import {
  deployContract,
  executeContract,
  Logger,
  setTimeoutDuration,
  sleep,
  uploadContract
} from "../helpers.js"
import {
  depositCw20,
  queryMaAssetAddress,
} from "./test_helpers.js"

// CONSTS

// required environment variables:
const CW_PLUS_ARTIFACTS_PATH = process.env.CW_PLUS_ARTIFACTS_PATH!

const INCENTIVES_UMARS_BALANCE = 1_000_000_000000
const UMARS_EMISSION_RATE = 1_000000

// HELPERS

async function setAssetIncentive(
  terra: LCDClient,
  wallet: Wallet,
  incentives: string,
  maTokenAddress: string,
  umarsEmissionRate: number,
  logger?: Logger
) {
  return await executeContract(terra, wallet, incentives,
    {
      set_asset_incentive: {
        ma_token_address: maTokenAddress,
        emission_per_second: String(umarsEmissionRate)
      }
    },
    { logger: logger }
  )
}

async function setupAsset(
  terra: LCDClient,
  wallet: Wallet,
  redBank: string,
  incentives: string,
  logger: Logger,
) {
  const contractAddr = await deployContract(terra, wallet, join(CW_PLUS_ARTIFACTS_PATH, "cw20_base.wasm"),
    {
      name: "Asset",
      symbol: "ASSET",
      decimals: 6,
      initial_balances: [{ address: wallet.key.accAddress, amount: String(1_000000) }],
    }
  )

  const asset = { cw20: { contract_addr: contractAddr } }

  await executeContract(terra, wallet, redBank,
    {
      init_asset: {
        asset,
        asset_params: {
          initial_borrow_rate: "0.1",
          max_loan_to_value: "0.55",
          reserve_factor: "0.2",
          liquidation_threshold: "0.65",
          liquidation_bonus: "0.1",
          interest_rate_model_params: {
            dynamic: {
              min_borrow_rate: "0.0",
              max_borrow_rate: "2.0",
              kp_1: "0.02",
              optimal_utilization_rate: "0.7",
              kp_augmentation_threshold: "0.15",
              kp_2: "0.05",
              update_threshold_txs: 1,
              update_threshold_seconds: 600,
            }
          },
          active: true,
          deposit_enabled: true,
          borrow_enabled: true
        }
      }
    },
    { logger: logger }
  )

  const maAsset = await queryMaAssetAddress(terra, redBank, asset)

  await setAssetIncentive(terra, wallet, incentives, maAsset, UMARS_EMISSION_RATE, logger)

  await depositCw20(terra, wallet, redBank, contractAddr, 1_000000, logger)
}

// MAIN

(async () => {
  // SETUP

  setTimeoutDuration(100)

  const logger = new Logger()

  const terra = new LocalTerra()

  // addresses
  const deployer = terra.wallets.test1
  const astroportFactory = new MnemonicKey().accAddress

  console.log("upload contracts")

  const addressProvider = await deployContract(terra, deployer, "../artifacts/mars_address_provider.wasm",
    { owner: deployer.key.accAddress }
  )

  const incentives = await deployContract(terra, deployer, "../artifacts/mars_incentives.wasm",
    {
      owner: deployer.key.accAddress,
      address_provider_address: addressProvider
    }
  )

  const maTokenCodeId = await uploadContract(terra, deployer, "../artifacts/mars_ma_token.wasm")

  const redBank = await deployContract(terra, deployer, "../artifacts/mars_red_bank.wasm",
    {
      config: {
        owner: deployer.key.accAddress,
        address_provider_address: addressProvider,
        safety_fund_fee_share: "0.1",
        treasury_fee_share: "0.2",
        ma_token_code_id: maTokenCodeId,
        close_factor: "0.5",
      }
    }
  )

  const staking = await deployContract(terra, deployer, "../artifacts/mars_staking.wasm",
    {
      config: {
        owner: deployer.key.accAddress,
        address_provider_address: addressProvider,
        astroport_factory_address: astroportFactory,
        astroport_max_spread: "0.05",
        cooldown_duration: 10,
        unstake_window: 300,
      }
    }
  )

  const mars = await deployContract(terra, deployer, join(CW_PLUS_ARTIFACTS_PATH, "cw20_base.wasm"),
    {
      name: "Mars",
      symbol: "MARS",
      decimals: 6,
      initial_balances: [{ address: incentives, amount: String(INCENTIVES_UMARS_BALANCE) }],
    }
  )

  const xMars = await deployContract(terra, deployer, "../artifacts/mars_xmars_token.wasm",
    {
      name: "xMars",
      symbol: "xMARS",
      decimals: 6,
      initial_balances: [],
      mint: { minter: staking },
    }
  )

  // update address provider
  await executeContract(terra, deployer, addressProvider,
    {
      update_config: {
        config: {
          owner: deployer.key.accAddress,
          incentives_address: incentives,
          mars_token_address: mars,
          red_bank_address: redBank,
          staking_address: staking,
          xmars_token_address: xMars,
          protocol_admin_address: deployer.key.accAddress,
        }
      }
    },
    { logger: logger }
  )

  // TESTS

  console.log("setup assets")

  await setupAsset(
    terra,
    deployer,
    redBank,
    incentives,
    logger,
  )

  console.log("claim rewards")

  // accumulate rewards
  await sleep(1000)

  const result = await executeContract(
    terra,
    deployer,
    incentives,
    { claim_rewards: {} },
    { logger: logger },
  )

  console.log(`assets: 1, gas used: ${result.gas_used}`)
  let nAssets = [1]
  let gasUsed = [result.gas_used]

  for (let i = 0; i < 5; i++) {
    console.log("setup assets")

    for (let j = 0; j < 10; j++) {
      await setupAsset(
        terra,
        deployer,
        redBank,
        incentives,
        logger,
      )

      if (j == 9) {
        console.log("claim rewards")

        // accumulate rewards
        await sleep(1000)

        const result = await executeContract(
          terra,
          deployer,
          incentives,
          { claim_rewards: {} },
          { logger: logger },
        )

        const n = (i + 1) * 10
        console.log(`assets: ${n}, gas used: ${result.gas_used}`)
        nAssets.push(n)
        gasUsed.push(result.gas_used)
      }
    }
  }

  console.log(`\nx = ${JSON.stringify(nAssets)}`)
  console.log(`y = ${JSON.stringify(gasUsed)}\n`)

  console.log("OK")
})()

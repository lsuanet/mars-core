use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{Addr, Api, StdResult, Uint128};
use cw20::Cw20ReceiveMsg;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema, Copy)]
pub struct Schedule {
    /// Time when vesting/unlocking starts
    pub start_time: u64,
    /// Time before with no token is to be vested/unlocked
    pub cliff: u64,
    /// Duration of the vesting/unlocking process. At time `start_time + duration`, the tokens are
    /// vested/unlocked in full
    pub duration: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config<T> {
    /// Address provider address
    /// T is to be `String` for the unchecked type, or `cosmwasm_std::Addr` for the checked type
    pub address_provider_address: T,
    /// Schedule for token unlocking; this schedule is the same for all users
    pub unlock_schedule: Schedule,
}

impl From<Config<Addr>> for Config<String> {
    fn from(config: Config<Addr>) -> Self {
        Config {
            address_provider_address: config.address_provider_address.to_string(),
            unlock_schedule: config.unlock_schedule,
        }
    }
}

impl Config<String> {
    pub fn check(&self, api: &dyn Api) -> StdResult<Config<Addr>> {
        Ok(Config {
            address_provider_address: api.addr_validate(&self.address_provider_address)?,
            unlock_schedule: self.unlock_schedule,
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Allocation {
    /// Total amount of MARS allocated
    pub allocated_amount: Uint128,
    /// Amount of MARS already withdrawn
    pub withdrawn_amount: Uint128,
    /// The user's vesting schedule
    pub vest_schedule: Schedule,
}

/// Snapshot of a recipient's xMARS amount. Used to calculate the recipient's voting power when
/// voting for a governance proposal.
///
/// The first number is block height. The second number is the amount of xMARS the recipient has at
/// this block height.
pub type Snapshot = (u64, Uint128);

pub mod msg {
    use super::*;

    pub type InstantiateMsg = Config<String>;

    #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
    #[serde(rename_all = "snake_case")]
    pub enum ExecuteMsg {
        /// Implementation of cw20 receive msg
        Receive(Cw20ReceiveMsg),
        /// Withdraw unlocked MARS token
        Withdraw {},
    }

    #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
    #[serde(rename_all = "snake_case")]
    pub enum ReceiveMsg {
        /// Create a new allocation for a recipeint
        CreateAllocation {
            user_address: String,
            vest_schedule: Schedule,
        },
    }

    #[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
    #[serde(rename_all = "snake_case")]
    pub enum QueryMsg {
        /// Config of this contract. Returns `Config<String>`
        Config {},
        /// Status of an allocation. Returns `Allocation`
        Allocation { user_address: String },
        /// Amount of Mars token owned by a user at a certain height, which equals the user's total
        /// allocated amount minus the amount they has withdrawn up to that height. Returns `Uint128`
        BalanceAt { user_address: String, block: u64 },
    }
}

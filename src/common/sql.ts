// prefixing queries with sql makes them easier to read when the
// comment-tagged-template extension in vs code is enabled
export const queries = {
  // wallet
  WALLET_INSERT: /* sql */ `
INSERT INTO wallet (id, name, user_order, address_index, type, path_type, encrypted)
VALUES (@id, @name, @user_order, @address_index, @type, @path_type, @encrypted)`,
  WALLET_UPDATE: /* sql */ `
UPDATE wallet SET name = @name
WHERE id = @id`,
  WALLET_COUNT: /* sql */ `
SELECT COUNT(*) as count FROM wallet`,
  // proof + work queries
  UPDATE_WORK_STATE: /* sql */ `
UPDATE proof SET work_state = @work_state
WHERE pool_id = @pool_id AND leaf_index = @leaf_index`,
  RESET_WORK_STATE: /* sql */ `
UPDATE proof SET work_state = 'waiting', last_work_activity_time = null
WHERE pool_id = @pool_id AND leaf_index = @leaf_index`,
  UPDATE_WORK_ACTIVITY: /* sql */ `
UPDATE proof SET last_work_activity_time = CURRENT_TIMESTAMP
WHERE pool_id = @pool_id AND leaf_index = @leaf_index`,
  UPDATE_MSG_ID: /* sql */ `
UPDATE proof SET message_hash = @message_hash, last_work_broadcast_time = CURRENT_TIMESTAMP
WHERE pool_id = @pool_id AND leaf_index = @leaf_index`,
  WALLET_ALL: /* sql */ `
SELECT user_order, id, name, address_index, type, path_type
FROM wallet`,
  // account queries
  ACCOUNT_INSERT: /* sql */ `
INSERT INTO account (wallet_id, address, address_index, added)
VALUES (@wallet_id, @address, @address_index, @added)`,
  ACCOUNT_UPDATE_ADDED: /* sql */ `
UPDATE account SET added = @added
WHERE wallet_id = @wallet_id AND address_index = @address_index`,
  CONTACT_UPSERT: /* sql */ `
INSERT INTO contact (address, name, note)
VALUES (@address, @name, @note)
ON CONFLICT (address)
DO UPDATE SET name = @name, note = @note`,
  CONTACT_UPDATE_ONE: /* sql */ `
UPDATE contact SET name = @name, note = @note
WHERE address = @address
RETURNING *`,
  ACCOUNT_GET: /* sql */ `
SELECT *
FROM account
WHERE wallet_id = @wallet_id AND address_index = @address_index`,
  ACCOUNT_ALL: /* sql */ `
SELECT *
FROM account`,
  ALL_ACCOUNTS_UNDER: /* sql */ `
SELECT *
FROM account
WHERE wallet_id = @id`,
  ACCOUNT_NULLIFY_ADDED: /* sql */ `
UPDATE account SET added = false
WHERE wallet_id = @wallet_id`,
  ACCOUNT_SET_ADDED: /* sql */ `
UPDATE account SET added = true
WHERE wallet_id = @wallet_id AND address_index = @address_index`,
  CONTACT_GET: /* sql */ `
SELECT * FROM contact
WHERE address = @address`,
  CONTACT_ALL: /* sql */ `
SELECT * FROM contact`,
  CONTACT_REMOVE: /* sql */ `
DELETE FROM contact
WHERE address = @address`,
  CHAIN_TRANSACTION_INSERT: /* sql */ `
INSERT INTO chain_transaction (hash, chain_id, action)
VALUES (@hash, @chain_id, @action)
ON CONFLICT (hash, chain_id) DO NOTHING`,
  ALL_TRANSACTIONS: /* sql */ `
SELECT * FROM chain_transaction`,
  /**
   * Removes a wallet from the database
   * @dev SQL query to delete a single wallet record
   * @param id The unique identifier of the wallet to remove
   * @notice This should be executed within a transaction with ACCOUNT_REMOVE_BY_WALLET
   */
  WALLET_REMOVE: /* sql */ `
DELETE FROM wallet 
WHERE id = @id`,

  /**
   * Removes all accounts belonging to a specific wallet
   * @dev SQL query to clean up associated account records
   * @param wallet_id The ID of the wallet whose accounts should be removed
   * @notice Should be executed before WALLET_REMOVE to maintain referential integrity
   * @notice Cascading delete might be preferable in schema design
   */
  ACCOUNT_REMOVE_BY_WALLET: /* sql */ `
DELETE FROM account 
WHERE wallet_id = @wallet_id`,
}

export const backendOnlyQueries = {
  WALLET_GET: /* sql */ `
SELECT * FROM wallet WHERE id = @id`,
  // proof queries
  PROOF_INSERT: /* sql */ `
INSERT INTO proof(chain_id, pool_id, leaf_index, work_state, secret, user_inputs)
VALUES (@chain_id, @pool_id, @leaf_index, @work_state, @secret, @user_inputs)
ON CONFLICT (pool_id, leaf_index)
DO UPDATE SET work_state = @work_state, secret = @secret, user_inputs = @user_inputs
RETURNING *`,
  MARK_PROOF_WORK_START: /* sql */ `
UPDATE proof
SET work_state = 'working', last_work_activity_time = CURRENT_TIMESTAMP, calldata = @calldata
WHERE pool_id = @pool_id
  AND leaf_index = @leaf_index`,
  MARK_PROOF_AS_WORKING: /* sql */ `
UPDATE proof
SET work_state = 'working', last_work_activity_time = CURRENT_TIMESTAMP
WHERE pool_id = @pool_id
  AND leaf_index = @leaf_index`,
  MARK_PROOF_AS_BROADCASTED: /* sql */ `
UPDATE proof
SET work_state = 'broadcasted',
  last_work_broadcast_time = CURRENT_TIMESTAMP
WHERE pool_id = @pool_id
  AND leaf_index = @leaf_index`,
  MARK_PROOF_AS_MINED: /* sql */ `
UPDATE proof SET work_state = 'mined'
WHERE pool_id = @pool_id
  AND leaf_index = @leaf_index`,
  DELETE_PROOF: /* sql */ `
DELETE FROM proof
WHERE pool_id = @pool_id
  AND leaf_index = @leaf_index`,
  PROOF_ALL: /* sql */ `
SELECT * FROM proof`,
  PROOF_ALL_BY_CHAIN_ID: /* sql */ `
SELECT * FROM proof
WHERE chain_id = @chain_id`,
  PROOF_ALL_WORK_STATE_PENDING: /* sql */ `
SELECT * FROM proof
WHERE work_state = 'waiting'
  OR work_state = 'broadcasted'
  OR work_state = 'working'
ORDER BY created_at ASC`,
  PROOF_ALL_PROCESSING: /* sql */ `
SELECT * FROM proof
WHERE work_state = 'broadcasted'
  OR work_state = 'working'`,
}

export type SQLQueryKeys = keyof typeof queries
export type BackendOnlySQLQueryKeys = keyof typeof backendOnlyQueries
export type AllSQLQueryKeys = SQLQueryKeys | BackendOnlySQLQueryKeys

export const sqliteDate = (dateString: string) => {
  if (dateString.endsWith('Z')) {
    // already converted
    return dateString
  }
  return `${dateString.split(' ').join('T')}Z`
}

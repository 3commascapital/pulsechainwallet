const { api, electron } = window
export const password = api.password
export const wallet = api.wallet
export const state = api.state
export const config = api.config
// export const pools = api.pools
export const indexer = api.indexer
export const ens = api.ens

export const ipcRenderer = electron.ipcRenderer

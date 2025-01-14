import { BigNumber, type BigNumberish } from '@ethersproject/bignumber'
import { hexZeroPad } from '@ethersproject/bytes'
import { poseidon } from './poseidon'
import { stringHash, toFE } from './common'

export type MerkleProof = {
  leaf: BigNumber
  root: BigNumber
  path: number
  siblings: BigNumber[]
}

export type MerkleTreeJSON = {
  layers: BigNumberish[][]
  zero: BigNumberish
}

export function verifyProof(proof: MerkleProof): boolean {
  const { leaf, root, path, siblings } = proof
  let hashValue = leaf
  for (let i = 0; i < siblings.length; i++) {
    const layerIndex = path >>> i
    if ((layerIndex & 1) === 1) {
      hashValue = poseidon([siblings[i], hashValue], 1)
    } else {
      hashValue = poseidon([hashValue, siblings[i]], 1)
    }
  }
  return root.eq(hashValue)
}

export class MerkleTree {
  readonly LEVELS: number
  readonly CAPACITY: number
  readonly zero: BigNumber
  public root: BigNumber
  public length: number
  protected _zeroValues: BigNumber[]
  protected _layers: BigNumber[][]

  public get leaves(): BigNumber[] {
    return this._layers[0].slice()
  }

  public get zeroValues(): BigNumber[] {
    return this._zeroValues.slice()
  }

  constructor({
    leaves,
    zeroString = 'empty',
    zero,
    levels = 20,
    onProgressUpdate,
  }: {
    leaves: BigNumberish[]
    zeroString?: string
    zero?: BigNumberish
    levels?: number
    onProgressUpdate?: (progress: number) => void
  }) {
    this.LEVELS = levels
    this.CAPACITY = 1 << levels
    if (typeof zeroString !== 'string') {
      throw new Error(`Invalid zeroString, expected a string.`)
    }
    if (zero) {
      try {
        this._zeroValues = [toFE(zero)]
      } catch {
        throw new Error(`Invalid zero input, expected BigNumberish value.`)
      }
    } else {
      this._zeroValues = [stringHash(zeroString)]
    }
    this.zero = this._zeroValues[0]
    for (let i = 0; i < this.LEVELS; i++) {
      this._zeroValues[i + 1] = poseidon([this._zeroValues[i], this._zeroValues[i]], 1)
    }
    if (!Array.isArray(leaves)) {
      throw new Error(`Invalid leaves, expected an array.`)
    } else if (leaves.length >= this.CAPACITY) {
      throw new Error(`Leaves length exceeds the maximum capacity of the tree.`)
    }
    const layers = new Array(this.LEVELS + 1)
    try {
      layers[0] = leaves.map(BigNumber.from)
    } catch {
      throw new Error(`Invalid leaves input, expected BigNumberish values.`)
    }
    if (layers[0].length > 0) {
      for (let i = 1; i < this.LEVELS + 1; i++) {
        const p = layers[i - 1].length
        const n = Math.ceil(p / 2)
        layers[i] = new Array(n)

        // Update progress
        const progress = (i / this.LEVELS) * 100

        // Call the progress update callback if provided
        if (onProgressUpdate) {
          onProgressUpdate(progress)
        }

        if (n > 0) {
          for (let j = 0; j < n - 1; j++) {
            layers[i][j] = poseidon([layers[i - 1][j * 2], layers[i - 1][j * 2 + 1]])
          }
          if ((p & 1) === 1) {
            layers[i][n - 1] = poseidon([layers[i - 1][p - 1], this._zeroValues[i - 1]])
          } else {
            layers[i][n - 1] = poseidon([layers[i - 1][p - 2], layers[i - 1][p - 1]])
          }
        }
      }
    } else {
      for (let i = 1; i < this.LEVELS + 1; i++) {
        layers[i] = []
      }
    }
    this._layers = layers
    this.root = this._layers[this.LEVELS][0] || this._zeroValues[this.LEVELS]
    this.length = layers[0].length
  }

  public insert(leaf: BigNumberish): number {
    const index = this.length
    if (index >= this.CAPACITY) {
      throw new Error(`The tree is at capacity. No more leaves can be inserted.`)
    }
    try {
      leaf = BigNumber.from(leaf)
    } catch {
      throw new Error(`Invalid insert leaf, expected BigNumberish value.`)
    }
    this._update(index, leaf)
    return index
  }

  public update(index: number, leaf: BigNumberish) {
    if (isNaN(index)) throw new Error(`Invalid value for index: ${index}`)
    if (index >= this.length) {
      throw new Error(`Index ${index} is out of bounds of tree with size ${this.length}.`)
    }
    try {
      leaf = BigNumber.from(leaf)
    } catch {
      throw new Error(`Invalid update leaf, expected BigNumberish value.`)
    }
    if (!this._layers[0][index].eq(leaf)) this._update(index, leaf)
  }

  protected _update(index: number, leaf: BigNumber) {
    this._layers[0][index] = leaf
    for (let i = 1; i < this.LEVELS + 1; i++) {
      const n = index >>> (i - 1)
      const p = n >>> 1
      if ((n & 1) === 1) {
        this._layers[i][p] = poseidon([this._layers[i - 1][n - 1], this._layers[i - 1][n]], 1)
      } else {
        if (n + 1 >= this._layers[i - 1].length) {
          this._layers[i][p] = poseidon([this._layers[i - 1][n], this._zeroValues[i - 1]], 1)
        } else {
          this._layers[i][p] = poseidon([this._layers[i - 1][n], this._layers[i - 1][n + 1]], 1)
        }
      }
    }
    this.root = this._layers[this.LEVELS][0]
    this.length = this._layers[0].length
  }

  public generateProof(index: number): MerkleProof {
    if (isNaN(index)) throw new Error(`Invalid value for index: ${index}`)
    if (this.length === 0 || index >= this.length) {
      throw new Error(`Index ${index} is out of bounds of tree with size ${this.length}.`)
    }
    const siblings = new Array(this.LEVELS)
    for (let i = 0; i < this.LEVELS; i++) {
      const layerIndex = index >>> i
      if ((layerIndex & 1) === 1) {
        siblings[i] = this._layers[i][layerIndex - 1]
      } else {
        if (layerIndex + 1 < this._layers[i].length) {
          siblings[i] = this._layers[i][layerIndex + 1]
        } else {
          siblings[i] = this._zeroValues[i]
        }
      }
    }
    return {
      leaf: this._layers[0][index],
      root: this._layers[this.LEVELS][0],
      path: index,
      siblings,
    }
  }

  public verifyProof(proof: MerkleProof): boolean {
    return this.root.eq(proof.root) && proof.siblings.length === this.LEVELS && verifyProof(proof)
  }

  public toJSON(): MerkleTreeJSON {
    return {
      zero: hexZeroPad(this._zeroValues[0].toHexString(), 32),
      layers: this._layers.map((layer) => {
        return layer.map((value) => hexZeroPad(value.toHexString(), 32))
      }),
    }
  }

  static fromJSON({ layers, zero }: MerkleTreeJSON): MerkleTree {
    try {
      zero = BigNumber.from(zero)
    } catch {
      throw new Error(`Invalid zero input, expected BigNumberish value.`)
    }
    let restoredLayers
    try {
      restoredLayers = layers.map((layer) => layer.map(BigNumber.from))
    } catch {
      throw new Error(`Invalid layers input, expected BigNumberish values.`)
    }
    const tree = new MerkleTree({ leaves: [], zero })
    tree._layers = restoredLayers
    tree.length = restoredLayers[0].length
    tree.root = tree._layers[tree.LEVELS][0] || tree._zeroValues[tree.LEVELS]
    return tree
  }

  static fromString(jsonString: string): MerkleTree {
    const parsedJson: MerkleTreeJSON = JSON.parse(jsonString)
    return MerkleTree.fromJSON(parsedJson)
  }

  static fullEmpty({
    treeLength,
    zeroString = 'empty',
    zero,
    levels = 20,
  }: {
    treeLength: number
    zeroString?: string
    zero?: BigNumberish
    levels?: number
  }): MerkleTree {
    const tree = new MerkleTree({ leaves: [], zeroString, zero, levels })

    const layers: BigNumber[][] = new Array(tree.LEVELS + 1)
    for (let i = 0; i <= tree.LEVELS; i++) {
      layers[i] = new Array(Math.ceil(treeLength / (1 << i))).fill(tree.zeroValues[i])
    }
    tree._layers = layers
    tree.length = treeLength
    tree.root = tree._zeroValues[tree.LEVELS]
    return tree
  }
}

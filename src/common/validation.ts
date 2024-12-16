export type AddressCheck = 'isContract' | 'isErc20'

export type AddressMetadata = Map<AddressCheck, boolean>

export type MismatchAddressConstraint = 'warning' | 'error'

export type AddressConstraint = Map<AddressCheck, MismatchAddressConstraint>

export const getMismatchedConstraints = (metadata: AddressMetadata, constraints: AddressConstraint) => {
  return new Map(
    Array.from(constraints).map(([check]) => {
      return [check, metadata.get(check) !== false ? constraints.get(check)! : null]
    }),
  )
}

export const defaultToAddressConstraints: AddressConstraint = new Map([
  ['isContract', 'warning'],
  ['isErc20', 'error'],
])

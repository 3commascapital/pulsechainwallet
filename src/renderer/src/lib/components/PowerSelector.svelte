<script lang="ts">
  import RangeSlider from 'svelte-range-slider-pips'
  import Number from './Number.svelte'
  import StepIncrementor from './StepIncrementor.svelte'
  import { maxPower } from '$common/pools'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let power!: number
  export let decimals = 18
  export let unit = ''
  export let disabled = false

  $: increment = 10n ** BigInt(power)

  const handleIncrement = (e: CustomEvent<bigint>) => {
    power += global.Number(e.detail)
    dispatch('change', {
      value: power,
    })
  }
</script>

<div class="flex w-full flex-col">
  <div class="w-full flex flex-row">
    <div class="flex flex-row flex-grow-0 items-center">
      <div class="input-group flex flex-col-reverse">
        <!-- decrement class is only needed because i couldn't find the vertical variant -->
        <StepIncrementor
          decrementDisabled={power === 0}
          incrementDisabled={power === maxPower}
          on:change={handleIncrement}
          decrementClass="border-t border-primary-400 rounded-t-none" />
      </div>
    </div>
    <div class="flex flex-col w-full">
      <span class="px-4"><Number truncateZeros x={increment} {decimals} />{unit}</span>
      <div class="flex flex-row flex-grow w-full">
        <div class="power-selector-wrapper w-full">
          <RangeSlider
            id="power-selector"
            on:change
            {disabled}
            bind:value={power}
            min={0}
            max={maxPower}
            step={1}
            pips
            float
            first="label"
            last="label" />
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  /**
   * @dev CSS Selector Specificity Enhancement
   * 
   * Before:
   * - Direct element targeting
   * - Production build style conflicts
   * - Inconsistent selector specificity
   * @code
   * :global(#power-selector) {
   *   @apply w-full;
   * }
   * :global(#power-selector .rangePips) {
   *   bottom: 0;
   *   top: -1em;
   * }
   * 
   * After:
   * - Added power-selector-wrapper container
   * - Consistent selector hierarchy
   * - Production-safe specificity
   * @code
   * :global(.power-selector-wrapper #power-selector) {
   *   @apply w-full;
   * }
   * :global(.power-selector-wrapper #power-selector .rangePips) {
   *   bottom: 0;
   *   top: -1em;
   * }
   * 
   * @notice Changes resolve:
   * 1. Style conflicts in production builds
   * 2. Inconsistent style application
   * 3. CSS specificity issues
   * 
   * @dev All selectors now include wrapper class for consistent specificity
   * @dev Maintains existing styling while ensuring production compatibility
   */
  :global(.power-selector-wrapper #power-selector) {
    @apply w-full;
  }
  /* Rest of styles remain the same but with increased specificity
     by targeting elements within power-selector-wrapper */
  :global(.power-selector-wrapper #power-selector .rangePips) {
    bottom: 0;
    top: -1em;
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip) {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    @apply bg-primary-500;
    transform: translate3d(-50%, 0, 0.1px) scale(0.1);
    opacity: 0.9999;
    will-change: transform opacity;
    display: flex;
  }

  :global(.power-selector-wrapper #power-selector .pipVal) {
    opacity: 0;
  }

  :global(.power-selector-wrapper #power-selector .rangeFloat) {
    opacity: 0;
    pointer-events: none;
  }

  :global(.power-selector-wrapper #power-selector .rangeNub) {
    @apply bg-primary-500;
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip.selected) {
    transform: translate3d(-50%, -6px, 0.1px) scale(0.8);
  }

  :global(.power-selector-wrapper #power-selector .pip.selected .pipVal) {
    opacity: 1;
    transition-duration: 0s;
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip.selected + *) {
    transform: translate3d(calc(-50% + 2px), -4px, 0.1px) scale(0.6);
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip.selected + * + *) {
    transform: translate3d(calc(-50% + 2px), -2px, 0.1px) scale(0.4);
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip.selected + * + * + *) {
    transform: translate3d(calc(-50% + 1px), -1px, 0.1px) scale(0.2);
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip:has(+ .selected)) {
    transform: translate3d(calc(-50% - 2px), -4px, 0.1px) scale(0.6);
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip:has(+ * + .selected)) {
    transform: translate3d(calc(-50% - 2px), -2px, 0.1px) scale(0.4);
  }

  :global(.power-selector-wrapper #power-selector .rangePips .pip:has(+ * + * + .selected)) {
    transform: translate3d(calc(-50% - 1px), -1px, 0.1px) scale(0.2);
  }

  :global(.power-selector-wrapper #power-selector.rangeSlider.hoverable:not(.disabled) .rangeHandle::before) {
    display: none;
    box-shadow: none;
  }
</style>

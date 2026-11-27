import { ValueTransformer } from 'typeorm';

/**
 * MySQL returns DECIMAL columns as strings to avoid precision loss.
 * WeightKg is DECIMAL(5,2), which a JavaScript number represents exactly,
 * so we convert it to a number for clean JSON (e.g. 65.5 instead of "65.50").
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};

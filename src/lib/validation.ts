export type ValidationErrors<K extends string = string> = Partial<Record<K, string>>;

export type ValidationRule<Value, Values> = (value: Value, values: Values) => string | undefined;
export type ValidationSchema<Values extends Record<string, unknown>> = {
  [K in keyof Values]?: ValidationRule<Values[K], Values> | Array<ValidationRule<Values[K], Values>>;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const rules = {
  required:
    <Values extends Record<string, unknown>>(message: string): ValidationRule<unknown, Values> =>
    (value) =>
      asString(value).length === 0 ? message : undefined,

  minLength:
    <Values extends Record<string, unknown>>(length: number, message: string): ValidationRule<unknown, Values> =>
    (value) =>
      asString(value).length < length ? message : undefined,

  pattern:
    <Values extends Record<string, unknown>>(regex: RegExp, message: string): ValidationRule<unknown, Values> =>
    (value) =>
      regex.test(asString(value)) ? undefined : message,

  equalsField:
    <Values extends Record<string, unknown>, K extends keyof Values>(
      otherKey: K,
      message: string
    ): ValidationRule<Values[K], Values> =>
    (value, values) =>
      value === values[otherKey] ? undefined : message,

  custom:
    <Value, Values extends Record<string, unknown>>(
      predicate: (value: Value, values: Values) => boolean,
      message: string
    ): ValidationRule<Value, Values> =>
    (value, values) =>
      predicate(value, values) ? undefined : message,
};

export function validate<Values extends Record<string, unknown>>(
  values: Values,
  schema: ValidationSchema<Values>
): ValidationErrors<Extract<keyof Values, string>> {
  const errors: ValidationErrors<Extract<keyof Values, string>> = {};

  for (const key of Object.keys(schema) as Array<keyof Values>) {
    const ruleOrRules = schema[key];
    if (!ruleOrRules) continue;

    const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
    for (const rule of rules) {
      const message = rule(values[key], values);
      if (message) {
        errors[key as Extract<keyof Values, string>] = message;
        break;
      }
    }
  }

  return errors;
}

export function getFirstValidationError<K extends string>(errors: ValidationErrors<K>): string | null {
  for (const key of Object.keys(errors) as K[]) {
    const message = errors[key];
    if (message) return message;
  }
  return null;
}

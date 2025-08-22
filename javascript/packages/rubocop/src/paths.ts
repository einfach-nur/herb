import { createRequire } from "module"
const require = createRequire(import.meta.url)

export const jsonCorrectorFormatterPath = require.resolve(
  "@herb-tools/rubocop/assets/json_corrector_formatter.rb",
)

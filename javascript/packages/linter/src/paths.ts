import { createRequire } from "module"
const require = createRequire(import.meta.url)

export const jsonCorrectorFormatterPath = require.resolve(
    "@herb-tools/linter/assets/json_corrector_formatter.rb",
)

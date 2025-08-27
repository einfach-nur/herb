class JSONCorrectorFormatter < RuboCop::Formatter::JSONFormatter
  def hash_for_offense(offense)
    super.tap do |hash|
      hash[:corrector] = {
        replacements: offense.corrector&.as_replacements&.map do |range, string|
          {
            range: {
              start: {
                line: range.line,
                column: range.column,
              },
              end: {
                line: range.last_line,
                column: range.last_column,
              },
            },
            string: string,
          }
        end,
      }
    end
  end
end

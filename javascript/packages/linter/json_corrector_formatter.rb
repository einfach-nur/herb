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
              column_range: {
                start: range.column_range.begin,
                end: range.column_range.end,
              },
            },
            string: string,
          }
        end,
      }
    end
  end
end

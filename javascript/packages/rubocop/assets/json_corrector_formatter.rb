class JSONCorrectorFormatter < RuboCop::Formatter::BaseFormatter
  attr_reader :output_hash

  def initialize(output, options = {})
    super
    @output_hash = { files: [] }
  end

  def file_finished(file, offenses)
    output_hash[:files] << hash_for_file(file, offenses)
  end

  def finished(_inspected_files)
    output.write output_hash.to_json
  end

  private

  def hash_for_file(_file, offenses)
    {
      offenses: offenses.map { |o| hash_for_offense(o) },
    }
  end

  def hash_for_offense(offense)
    {
      severity: offense.severity,
      copName: offense.cop_name,
      message: offense.message,
      location: {
        start: {
          line: offense.line,
          column: offense.column,
        },
        end: {
          line: offense.last_line,
          column: offense.last_column,
        },
      },
      correctable: offense.correctable?,
      corrections: offense.corrector&.as_replacements&.map do |range, string|
        {
          string: string,
          location: {
            start: {
              line: range.line,
              column: range.column,
            },
            end: {
              line: range.last_line,
              column: range.last_column,
            },
          },
        }
      end || [],
    }
  end
end

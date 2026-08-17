# Contributing

Thank you for improving this public reader.

## Before opening a change

1. Keep the repository public-safe. Do not add tokens, private deployment files, personal data, bundled official PDFs, or private analytics configuration.
2. Run the checks:

   ```powershell
   npm.cmd test
   npm.cmd run build
   ```

3. Include the result in your pull request.

## Legal-data changes

Every proposed legal-data change must include:

- the official URL used as the source;
- the date you checked the official source;
- the test result after the change.

If a source is unclear, prefer linking to the official original and explain the uncertainty instead of guessing.

## Documentation and code changes

Use beginner-friendly wording in public docs. Keep deployment IDs, environment values, and analytics details out of the repository.

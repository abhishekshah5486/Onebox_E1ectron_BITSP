// "OneBox/Receipts" reads as "My Drive / OneBox / Receipts"; empty is the top of My Drive.
export const drivePathLabel = (path: string) =>
  [
    'My Drive',
    ...path
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean),
  ].join(' / ');

export class SecretRedactor {
  private readonly entries: readonly [name: string, value: string][];

  constructor(secrets: Record<string, string> | undefined) {
    this.entries = Object.entries(secrets ?? {})
      .filter(([, value]) => value.length > 0)
      .sort(
        ([leftName, leftValue], [rightName, rightValue]) =>
          rightValue.length - leftValue.length ||
          leftName.localeCompare(rightName)
      );
  }

  redact(text: string): string {
    let result = text;
    for (const [name, value] of this.entries) {
      result = result.split(value).join(`<redacted:${name}>`);
    }
    return result;
  }

  get enabled(): boolean {
    return this.entries.length > 0;
  }
}

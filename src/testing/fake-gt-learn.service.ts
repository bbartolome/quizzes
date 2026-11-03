/**
 * In-memory GtLearnService for page specs. The real service has no read methods yet (T2),
 * so this fake only holds what a spec seeds: which concepts count as introduced.
 * Pages read introduced ids through it once G9 adds the read surface.
 */
export class FakeGtLearnService {
  readonly introduced = new Set<string>();

  seedIntroduced(conceptIds: readonly string[]): void {
    for (const id of conceptIds) {
      this.introduced.add(id);
    }
  }
}

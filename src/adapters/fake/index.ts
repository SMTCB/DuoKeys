// TA-PORT-004 — barrel for the five fake port implementations plus FakeClock.

export { FakeClock } from './fakeClock';
export { FakeMidiBackend, type FixtureEvent, type PerformanceFixture } from './fakeMidiBackend';
export { FakeAudioBackend, type RecordedNote, type RecordedStop, type RecordedSample } from './fakeAudioBackend';
export { FakeStorageBackend } from './fakeStorageBackend';
export { FakeSyncBackend } from './fakeSyncBackend';
export { FakeContentBackend } from './fakeContentBackend';

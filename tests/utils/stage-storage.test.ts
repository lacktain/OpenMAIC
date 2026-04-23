import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  stagesPutMock,
  stagesGetMock,
  scenesDeleteMock,
  scenesSortByMock,
  scenesEqualsMock,
  scenesWhereMock,
  loadChatSessionsMock,
  saveChatSessionsMock,
  deleteChatSessionsMock,
} = vi.hoisted(() => {
  const scenesDeleteMock = vi.fn();
  const scenesSortByMock = vi.fn();
  const scenesEqualsMock = vi.fn(() => ({
    delete: scenesDeleteMock,
    sortBy: scenesSortByMock,
  }));
  const scenesWhereMock = vi.fn(() => ({
    equals: scenesEqualsMock,
  }));

  return {
    stagesPutMock: vi.fn(),
    stagesGetMock: vi.fn(),
    scenesDeleteMock,
    scenesSortByMock,
    scenesEqualsMock,
    scenesWhereMock,
    loadChatSessionsMock: vi.fn(),
    saveChatSessionsMock: vi.fn(),
    deleteChatSessionsMock: vi.fn(),
  };
});

vi.mock('@/lib/utils/database', () => ({
  db: {
    stages: {
      put: stagesPutMock,
      get: stagesGetMock,
      delete: vi.fn(),
      orderBy: vi.fn(),
      update: vi.fn(),
    },
    scenes: {
      where: scenesWhereMock,
    },
  },
}));

vi.mock('@/lib/utils/chat-storage', () => ({
  loadChatSessions: loadChatSessionsMock,
  saveChatSessions: saveChatSessionsMock,
  deleteChatSessions: deleteChatSessionsMock,
}));

vi.mock('@/lib/utils/playback-storage', () => ({
  clearPlaybackState: vi.fn(),
}));

import { loadStageData, saveStageData } from '@/lib/utils/stage-storage';

describe('stage-storage pedagogical metadata persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scenesSortByMock.mockResolvedValue([]);
    loadChatSessionsMock.mockResolvedValue([]);
  });

  test('saveStageData preserves pedagogical blueprint metadata on the stored stage', async () => {
    const now = Date.now();

    await saveStageData('stage-1', {
      stage: {
        id: 'stage-1',
        name: 'Teacher reviewed classroom',
        description: 'Cloud safety lesson',
        createdAt: now,
        updatedAt: now,
        style: 'vocational',
        pedagogicalBlueprint: {
          lessonBlueprint: {
            schemaVersion: 'pedagogical-blueprint/v1',
            lessonTitle: 'Cloud safety lesson',
          },
          review: {
            revisionCount: 2,
            reviewerResults: [],
            approvedOutlines: [],
            adjudication: {
              verdict: 'approved',
              summary: 'Ready to share',
              revisionNeeded: false,
            },
            reviewRounds: [],
          },
        } as never,
      },
      scenes: [],
      currentSceneId: null,
      chats: [],
    });

    expect(stagesPutMock).toHaveBeenCalledTimes(1);
    expect(stagesPutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stage-1',
        name: 'Teacher reviewed classroom',
        pedagogicalBlueprint: expect.objectContaining({
          review: expect.objectContaining({
            revisionCount: 2,
          }),
        }),
      }),
    );
    expect(saveChatSessionsMock).toHaveBeenCalledWith('stage-1', []);
  });

  test('loadStageData returns pedagogical blueprint metadata from storage', async () => {
    stagesGetMock.mockResolvedValue({
      id: 'stage-2',
      name: 'Imported classroom',
      createdAt: 1,
      updatedAt: 2,
      pedagogicalBlueprint: {
        lessonBlueprint: {
          schemaVersion: 'pedagogical-blueprint/v1',
          lessonTitle: 'Imported classroom',
        },
        review: {
          revisionCount: 1,
          reviewerResults: [],
          approvedOutlines: [],
          adjudication: {
            verdict: 'approved',
            summary: 'Imported intact',
            revisionNeeded: false,
          },
          reviewRounds: [],
        },
      },
    });

    const loaded = await loadStageData('stage-2');

    expect(loaded?.stage.pedagogicalBlueprint?.review.revisionCount).toBe(1);
    expect(loaded?.scenes).toEqual([]);
    expect(loaded?.chats).toEqual([]);
    expect(scenesWhereMock).toHaveBeenCalledWith('stageId');
  });
});

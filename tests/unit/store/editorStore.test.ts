import { useEditorStore, EditState } from '../../../src/store/useEditorStore';

describe('useEditorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().initEditor('1', 'file://image.jpg');
  });

  it('initializes with default state', () => {
    const store = useEditorStore.getState();
    expect(store.originalAssetId).toBe('1');
    expect(store.originalUri).toBe('file://image.jpg');
    expect(store.currentState.brightness).toBe(0);
    expect(store.currentState.filter).toBe('Original');
    expect(store.historyIndex).toBe(0);
  });

  it('updates state and adds to history', () => {
    useEditorStore.getState().updateState({ brightness: 0.5 });
    const store = useEditorStore.getState();
    
    expect(store.currentState.brightness).toBe(0.5);
    expect(store.history.length).toBe(2);
    expect(store.historyIndex).toBe(1);
  });

  it('handles undo correctly', () => {
    useEditorStore.getState().updateState({ brightness: 0.5 });
    useEditorStore.getState().undo();
    
    const store = useEditorStore.getState();
    expect(store.currentState.brightness).toBe(0);
    expect(store.historyIndex).toBe(0);
  });

  it('handles redo correctly', () => {
    useEditorStore.getState().updateState({ brightness: 0.5 });
    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    
    const store = useEditorStore.getState();
    expect(store.currentState.brightness).toBe(0.5);
    expect(store.historyIndex).toBe(1);
  });

  it('truncates redo history on new edit', () => {
    useEditorStore.getState().updateState({ brightness: 0.5 }); // history = [A, B]
    useEditorStore.getState().undo(); // historyIndex = 0
    useEditorStore.getState().updateState({ contrast: 1.5 }); // history = [A, C]
    
    const store = useEditorStore.getState();
    expect(store.history.length).toBe(2);
    expect(store.currentState.contrast).toBe(1.5);
    expect(store.currentState.brightness).toBe(0);
  });

  it('resets to initial state but keeps it in history', () => {
    useEditorStore.getState().updateState({ brightness: 0.5 });
    useEditorStore.getState().reset();
    
    const store = useEditorStore.getState();
    expect(store.currentState.brightness).toBe(0);
    expect(store.historyIndex).toBe(2);
    expect(store.history.length).toBe(3);
  });

  it('handles crop combined with rotation and flips', () => {
    const crop = { originX: 0.1, originY: 0.1, width: 0.8, height: 0.8 };
    useEditorStore.getState().updateState({ rotation: 90, flipX: true, crop });
    
    const store = useEditorStore.getState();
    expect(store.currentState.rotation).toBe(90);
    expect(store.currentState.flipX).toBe(true);
    expect(store.currentState.crop).toEqual(crop);
  });

  it('handles crop Apply and Cancel behavior via state mutations', () => {
    const crop = { originX: 0.5, originY: 0.5, width: 0.5, height: 0.5 };
    // Simulated Apply
    useEditorStore.getState().updateState({ crop });
    expect(useEditorStore.getState().currentState.crop).toEqual(crop);

    // Simulated Cancel (Undo)
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().currentState.crop).toBeUndefined();
  });
});

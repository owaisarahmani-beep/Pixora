import React from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { toastController, ToastProvider, useToastStore } from '../../../src/components/common/Toast';

const renderWithSafeArea = async (ui: React.ReactElement) => {
  return await render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
};

describe('Toast & Notification Feedback UI', () => {
  beforeEach(() => {
    toastController.dismiss();
    useToastStore.setState({ currentToast: null });
  });

  afterEach(async () => {
    toastController.dismiss();
    useToastStore.setState({ currentToast: null });
    await cleanup();
  });

  it('renders nothing when no toast is active', async () => {
    const { queryByTestId } = await renderWithSafeArea(<ToastProvider />);
    expect(queryByTestId('toast-pill')).toBeNull();
  });

  it('displays a success toast when triggered', async () => {
    const { getByText, getByTestId } = await renderWithSafeArea(<ToastProvider />);

    toastController.show({
      message: 'Album created successfully',
      type: 'success',
      duration: 3000,
    });

    await waitFor(() => {
      expect(getByText('Album created successfully')).toBeTruthy();
      expect(getByTestId('toast-pill')).toBeTruthy();
    });
  });

  it('displays an error toast with clear explanation', async () => {
    const { getByText, getByTestId } = await renderWithSafeArea(<ToastProvider />);

    toastController.show({
      message: 'Could not delete protected files',
      type: 'error',
      duration: 3000,
    });

    await waitFor(() => {
      expect(getByText('Could not delete protected files')).toBeTruthy();
      expect(getByTestId('toast-pill')).toBeTruthy();
    });
  });

  it('auto-dismisses after the specified duration', async () => {
    const { getByText, queryByText } = await renderWithSafeArea(<ToastProvider />);

    toastController.show({
      message: 'Transient confirmation',
      type: 'info',
      duration: 80,
    });

    await waitFor(() => {
      expect(getByText('Transient confirmation')).toBeTruthy();
    });

    // Wait for 80ms duration to expire
    await waitFor(() => {
      expect(queryByText('Transient confirmation')).toBeNull();
    }, { timeout: 1500 });
  });

  it('dismiss() manually clears the active toast immediately', async () => {
    const { getByText, queryByText } = await renderWithSafeArea(<ToastProvider />);

    toastController.show({
      message: 'Will be dismissed manually',
      type: 'info',
      duration: 5000,
    });

    await waitFor(() => {
      expect(getByText('Will be dismissed manually')).toBeTruthy();
    });

    toastController.dismiss();

    await waitFor(() => {
      expect(queryByText('Will be dismissed manually')).toBeNull();
    });
  });
});

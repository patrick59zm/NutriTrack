import { ReceiptRow } from '@/components/receipt-row';
import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { useFocusData } from '@/hooks/use-focus-data';
import { loadReceipts } from '@/lib/storage';

export default function HistoryScreen() {
  const { data: receipts, loaded } = useFocusData(loadReceipts, []);

  return (
    <Screen>
      {loaded && receipts.length === 0 && (
        <Card>
          <ThemedText type="smallBold">No receipts yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Scanned receipts show up here, newest first.
          </ThemedText>
        </Card>
      )}
      {receipts.map((r) => (
        <ReceiptRow key={r.id} receipt={r} />
      ))}
    </Screen>
  );
}

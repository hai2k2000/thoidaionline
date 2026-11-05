import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:thoidai_work_flutter/main.dart';
import 'package:thoidai_work_flutter/features/offline_page.dart';
import 'package:thoidai_work_flutter/widgets/branded_loading.dart';

void main() {
  test('only configured HTTPS origin stays in the WebView', () {
    expect(isInternalUrl(Uri.parse('https://thoidai.online/tasks')), isTrue);
    for (final value in ['https://thoidai.online.evil.test', 'http://thoidai.online', 'https://thoidai.online:444', 'tel:123', 'mailto:a@example.com']) {
      expect(isInternalUrl(Uri.parse(value)), isFalse);
    }
  });
  test('download filenames cannot escape app storage', () {
    final uri = Uri.parse('https://thoidai.online/api/download');
    expect(safeDownloadName('../../report.pdf', uri), 'report.pdf');
    expect(safeDownloadName(r'..\report.pdf', uri), 'report.pdf');
    expect(safeDownloadName('..', uri), 'download');
  });
  testWidgets('offline view exposes retry', (tester) async {
    var retried = false;
    await tester.pumpWidget(MaterialApp(home: OfflinePage(onRetry: () => retried = true)));
    await tester.tap(find.byWidgetPredicate((widget) => widget is FilledButton));
    expect(retried, isTrue);
  });
  testWidgets('branded loading displays its status', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: BrandedLoading(message: 'Loading work'))));
    expect(find.text('Loading work'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}

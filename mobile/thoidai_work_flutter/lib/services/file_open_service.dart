import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

class FileOpenService {
  Future<void> openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) throw Exception('Link không hợp lệ.');

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('Không mở được link.');
    }
  }

  Future<void> downloadAndOpen(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) throw Exception('Link tệp không hợp lệ.');

    final response = await http.get(uri);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Không tải được tệp (${response.statusCode}).');
    }

    final directory = await getApplicationDocumentsDirectory();
    final fileName = _fileNameFromUri(uri, response.bodyBytes);
    final file = File('${directory.path}/$fileName');
    await file.writeAsBytes(response.bodyBytes, flush: true);

    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done) {
      throw Exception(result.message);
    }
  }

  String _fileNameFromUri(Uri uri, Uint8List bytes) {
    final rawName = uri.pathSegments.isEmpty ? '' : uri.pathSegments.last;
    final name = rawName.split('?').first;
    if (name.contains('.') && name.length <= 120) {
      return name.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    }

    return 'thoidai-file-${DateTime.now().millisecondsSinceEpoch}.${_guessExtension(bytes)}';
  }

  String _guessExtension(Uint8List bytes) {
    if (bytes.length >= 4 &&
        bytes[0] == 0x25 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x44 &&
        bytes[3] == 0x46) {
      return 'pdf';
    }

    if (bytes.length >= 4 &&
        bytes[0] == 0x50 &&
        bytes[1] == 0x4b &&
        bytes[2] == 0x03 &&
        bytes[3] == 0x04) {
      return 'docx';
    }

    return 'bin';
  }
}

import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  final _connectivity = Connectivity();

  Stream<bool> get onlineStream {
    return _connectivity.onConnectivityChanged.map(_hasConnection);
  }

  Future<bool> isOnline() async {
    return _hasConnection(await _connectivity.checkConnectivity());
  }

  bool _hasConnection(List<ConnectivityResult> results) {
    if (results.isEmpty) return false;
    return results.any((result) => result != ConnectivityResult.none);
  }
}

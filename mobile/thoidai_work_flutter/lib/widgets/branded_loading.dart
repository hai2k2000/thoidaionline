import 'package:flutter/material.dart';

class BrandedLoading extends StatelessWidget {
  const BrandedLoading({
    this.message = 'Đang tải dữ liệu...',
    super.key,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.92, end: 1),
            duration: const Duration(milliseconds: 850),
            curve: Curves.easeInOut,
            builder: (context, value, child) {
              return Transform.scale(scale: value, child: child);
            },
            onEnd: () {},
            child: Image.asset('assets/app-icon.png', height: 82),
          ),
          const SizedBox(height: 18),
          const SizedBox(
            width: 34,
            height: 34,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(color: Color(0xff64748b)),
          ),
        ],
      ),
    );
  }
}

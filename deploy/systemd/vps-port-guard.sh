#!/bin/sh
set -eu

# WireGuard management tunnel and SSH access over wg0.
iptables -C INPUT -i eth0 -p udp --dport 51820 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -i eth0 -p udp --dport 51820 -j ACCEPT
iptables -C INPUT -i wg0 -p tcp --dport 24700 -j ACCEPT 2>/dev/null \
  || iptables -I INPUT 1 -i wg0 -p tcp --dport 24700 -j ACCEPT
if ip6tables -L INPUT >/dev/null 2>&1; then
  ip6tables -C INPUT -i eth0 -p udp --dport 51820 -j DROP 2>/dev/null \
    || ip6tables -I INPUT 1 -i eth0 -p udp --dport 51820 -j DROP
fi

# Keep app internals reachable through nginx/localhost only.
iptables -C INPUT -i eth0 -p tcp -m multiport --dports 3000,3001,3100 -j DROP 2>/dev/null \
  || iptables -I INPUT 1 -i eth0 -p tcp -m multiport --dports 3000,3001,3100 -j DROP

# Docker-published Supabase ports for thoidai/staging: block internet, allow host/nginx local traffic.
for port in 54324 54331 54332 55321 55322 55324; do
  iptables -C DOCKER-USER -i eth0 -p tcp -m conntrack --ctorigdstport "$port" -j DROP 2>/dev/null \
    || iptables -I DOCKER-USER 1 -i eth0 -p tcp -m conntrack --ctorigdstport "$port" -j DROP
  if ip6tables -L DOCKER-USER >/dev/null 2>&1; then
    ip6tables -C DOCKER-USER -i eth0 -p tcp -m conntrack --ctorigdstport "$port" -j DROP 2>/dev/null \
      || ip6tables -I DOCKER-USER 1 -i eth0 -p tcp -m conntrack --ctorigdstport "$port" -j DROP || true
  fi
done

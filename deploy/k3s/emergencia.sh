#!/bin/bash
# Takes the site back to the compose file at the repo root, for when k3s is
# broken. Linked as /root/compose-emergencia/leandrosf.sh.
# No database: it starts the container and points the vhost back to it. The
# image is rebuilt from the public/ the last k3s deploy left behind, which is
# the same content the pod was serving.
source /apisbr/automation/infra/k3s/emergencia/comum.sh
para_k3s leandrosf
cd /root/leandrosf.com && docker compose up -d --build
volta_vhost website

#!/bin/bash
# Deploys the site to k3s. Runs on alcserver000 as root, from the clone in
# /root/leandrosf.com (`make k3s-deploy` pulls it and calls this).
# lib.sh (build, push to the local registry, apply) lives in the alicercelabs
# repo, cloned at /apisbr, next to the rest of the server infrastructure.
source /apisbr/automation/infra/k3s/lib.sh
cd "$(dirname "$0")"
REPO=/root/leandrosf.com

# public/ is not in git: the Dockerfile copies whatever the last Hugo build left
# there, so the build happens here, the same way `make all` did it (clean, then
# hugo). The absolute path is on purpose: the Hugo that builds the live site is
# /usr/local/sbin/hugo (0.151.0 extended), which sudo's secure_path does not
# see, and /root/leandrosf.com/hugo is an older 0.123 that PaperMod refuses.
HUGO=${HUGO:-/usr/local/sbin/hugo}
rm -rf "$REPO/public"
(cd "$REPO" && "$HUGO" --quiet)

garante_namespace leandrosf
build leandrosf-website "$REPO"
aplica . leandrosf
# The site has no data for compose and pod to fight over, so compose is only
# stopped once the pod is serving. That leaves the old container answering
# until the edge vhost moves to the ingress on the first cutover.
para_compose "$REPO"
emergencia leandrosf emergencia.sh

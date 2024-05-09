#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
export HOME="/home/ec2-user/"
export PM2_HOME=/home/ec2-user/.pm2
sudo pm2 stop all
sudo pm2 delete all
sudo pm2 save -f

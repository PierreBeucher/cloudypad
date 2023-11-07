export DISPLAY=:0
sudo chown $(id -un):$(id -gn) /dev/uinput
sudo chown sunshine /dev/tty*
nohup startx > startx.log 2>&1 &
nohup sunshine > sunshine.log 2>&1 &
import os
import subprocess
from datetime import datetime
import time

from scapy.all import sniff
from scapy.config import conf

import psutil

"""
Watches for network download activity over given duration and threshold
"""
class NetworkDownloadActivityChecker:

    def __init__(self, threshold_mbps=10, check_duration=5):
        self.threshold_mbps = threshold_mbps
        self.check_duration = check_duration

    def detect_network_download_activity(self):
        """
        Check if network download speed exceeds the threshold in Mbps over the check duration.
        Returns True if activity is detected, False otherwise.
        """
        initial_bytes = psutil.net_io_counters().bytes_recv
        time.sleep(self.check_duration)
        final_bytes = psutil.net_io_counters().bytes_recv

        download_speed_mbps = (final_bytes - initial_bytes) * 8 / (self.check_duration * 1_000_000)

        print(f"Current download speed (over {self.check_duration} seconds): {download_speed_mbps} Mbps")
        
        return download_speed_mbps > self.threshold_mbps


"""
Watches for Moonlight activity on given port (47999 / Control by default)
"""
class MoonlightNetworkActivityChecker:

    def __init__(self, port=47999, timeout=5, packet_count=1):
        self.port = port
        self.timeout = timeout
        self.packet_count = packet_count

    def detect_moonlight_network_activity(self):
        """
        Check for network activity on Moonlight port (47999 / Control by default).
        Listen for both incoming and outgoing UDP traffic for given timeout and packet count.
        If traffic is detected, return True, otherwise return False.
        """
        
        # Sniff on all interfaces
        interfaces = list(conf.ifaces.keys())
        
        packets = sniff(iface=interfaces, filter=f"port {self.port}", timeout=self.timeout, count=self.packet_count)
        return bool(packets)

"""
Watches for Moonlight activity (eg. a used is connected to instance) and download activity (eg. a game is being downloaded).
- If inactivity is detected, instance is shutdown. 
- If user is actively using the instance (either connected to Moonlight or downloading a game), instance won't be shutdown.

Goal is to avoid overcost by letting unused instance run.

"""
def main():
    # Inactivity timeout (in seconds, default: 15 min)
    inactivity_timeout = int(os.getenv('CLOUDYPAD_AUTOSTOP_TIMEOUT', 15*60)) 

    # Period between each check (in seconds, default: 30s)
    check_period_seconds = int(os.getenv('CLOUDYPAD_AUTOSTOP_CHECK_PERIOD_SECONDS', 30))

    # Moonlight port on which to check for activity (default: 47999)
    moonlight_activity_port = int(os.getenv('CLOUDYPAD_AUTOSTOP_MOONLIGHT_ACTIVITY_PORT', 47999))

    # Dry run mode
    dry_run = os.getenv('CLOUDYPAD_AUTOSTOP_DRY_RUN', 'false').lower() in ('true', '1')

    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"{current_date} - Starting Cloudy Pad Autostop")
    print(f"{current_date} - Inactivity timeout: {inactivity_timeout} seconds")
    print(f"{current_date} - Check period: {check_period_seconds} seconds")
    print(f"{current_date} - Dry run: {dry_run}")

    moonlight_checker = MoonlightNetworkActivityChecker(port=moonlight_activity_port)    
    network_download_checker = NetworkDownloadActivityChecker()
    
    last_activity_time = time.time()

    # Main loop to continuously check for traffic
    while True:
        try:
            current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            moonlight_activity = moonlight_checker.detect_moonlight_network_activity()
            network_download_activity = network_download_checker.detect_network_download_activity()

            if moonlight_activity or network_download_activity:
                print(f"{current_date} - Moonlight traffic detected on port {moonlight_activity_port}: {moonlight_activity}")
                print(f"{current_date} - Network download activity detected: {network_download_activity}")
                last_activity_time = time.time()
            else:
                current_inactivity = int(time.time() - last_activity_time)
                print(f"{current_date} - Neither Moonlight traffic (on port {moonlight_activity_port}) nor network download activity detected.")
                print(f"Current inactivity: {current_inactivity} seconds ({inactivity_timeout - current_inactivity} seconds remaining before timeout)")
                if current_inactivity >= inactivity_timeout:
                    print(f"{current_date} - Inactivity timeout reached: {inactivity_timeout} seconds. Shutting down the instance.")
                    if dry_run:
                        print(f"{current_date} - Would shutdown the instance. Continuing as running in dry run mode...")
                    else:
                        print(f"{current_date} - Inactivity timeout detected. Shutting down the machine...")
                        subprocess.run(['sudo', 'shutdown', '-h', 'now'], check=True)
                        break
        except Exception as e:
            print(f"{current_date} - Error checking Moonlight network activity: {e}")

        time.sleep(check_period_seconds)  # Sleep before next check

if __name__ == "__main__":
    main()
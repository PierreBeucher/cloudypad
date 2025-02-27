import os
import subprocess
import tempfile
import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import time

#
# Small utilitary script to watch for machine inactivity 
# On detecting inactivity longer than timeout, shutdown instance
#
# Currently uses Sunshine logs
# 

class SunshineActivityChecker:

    def parse_sunshine_logs_last_activity(self, log_file_path):
        print(f"Parsing Sunshine logs from {log_file_path}")

        sunshine_timezone = self.get_sunshine_timezone()

        print(f"Found Sunshine Timezone: {sunshine_timezone}")

        last_activity_date = datetime.now()

        with open(log_file_path, 'r') as log_file:
            log_lines = log_file.readlines()

        # Parse log lines in reverse, stop at first encountered marker:
        # - Disonnected: latest event is client disconnected
        # - Connected: latest event is client connected, still active
        # - Sunshine version: indicate server just started, no client connected yet
        for line in reversed(log_lines):
            if "CLIENT DISCONNECTED" in line:
                last_activity_date = self.extract_timestamp_from_sunshine_log_line(line, sunshine_timezone)
                break
            elif "CLIENT CONNECTED" in line:
                print(f"Found CLIENT CONNECTED in log file, assuming a client is currently connected: using current server datetime as last Sunshine activity date")
                last_activity_date = self.get_current_server_datetime()
                break
            elif "Sunshine version:" in line:
                last_activity_date = self.extract_timestamp_from_sunshine_log_line(line, sunshine_timezone)
                break

        print(f"Found last activity date in {log_file_path}: {last_activity_date}")

        return last_activity_date

    def extract_timestamp_from_sunshine_log_line(self, log_line, time_zone):
        print(f"Extracting timestamp from log line: {log_line.strip()}")
        
        match = re.search(r'\[(.*?)\]', log_line)
        
        if not match:
            raise ValueError(f"Failed to extract timestamp from log line: {log_line}")
        
        # Sunshine logs do not have timezone information, so we need to add it manually
        # Create a date string such as 2025-02-27 10:00:00.000000+00:00
        dateString = f"{match.group(1)}{time_zone}"
        
        print(f"Matched date string with TZ: {dateString}")

        sunshine_log_timestamp = datetime.strptime(dateString, '%Y-%m-%d %H:%M:%S.%f%z')

        if not sunshine_log_timestamp:
            raise ValueError(f"Failed to extract timestamp from log line: {log_line}")
        
        print(f"Extracted timestamp: {sunshine_log_timestamp}")

        return sunshine_log_timestamp

    def compute_inactive_duration_seconds(self, current_server_datetime, last_sunshine_activity_datetime, machine_start_datetime):
        print(f"Computing inactive duration: ")
        print(f"Current server datetime:\t\t{current_server_datetime}")
        print(f"Last Sunshine activity datetime:\t{last_sunshine_activity_datetime}")
        print(f"Machine start datetime:\t\t\t{machine_start_datetime}")

        if not last_sunshine_activity_datetime or not machine_start_datetime:
            return -1

        inactivity_sunshine_ms = (current_server_datetime - last_sunshine_activity_datetime).total_seconds()
        inactivity_instance_ms = (current_server_datetime - machine_start_datetime).total_seconds()

        print(f"Inactivity Sunshine: {inactivity_sunshine_ms}, Inactivity Instance: {inactivity_instance_ms}")

        return int(min(inactivity_sunshine_ms, inactivity_instance_ms))

    def get_current_server_datetime(self):
        server_datetime = datetime.now().astimezone()
        print(f"Current server datetime: {server_datetime}")
        return server_datetime

    def get_sunshine_logs(self):
        local_log_path = tempfile.NamedTemporaryFile(delete=False).name

        subprocess.run(['docker', 'cp', 'cloudy:/cloudy/log/sunshine.log', '/tmp/sunshine.log'], check=True)
        subprocess.run(['cp', '/tmp/sunshine.log', local_log_path], check=True)
        return local_log_path

    def get_sunshine_timezone(self):
        timezone = subprocess.check_output(['docker', 'exec', 'cloudy', 'date', '+%z']).decode('utf-8').strip()
        return timezone

    def get_current_machine_start_time(self):
        with open('/proc/uptime', 'r') as f:
            uptime_seconds = float(f.readline().split()[0])
        
        machine_start_time = datetime.now().astimezone() - timedelta(seconds=uptime_seconds)
        return machine_start_time
        
    def get_inactive_duration_seconds(self):
        log_file_path = self.get_sunshine_logs()
        last_sunshine_activity_datetime = self.parse_sunshine_logs_last_activity(log_file_path)

        machine_start_datetime = self.get_current_machine_start_time()

        current_server_date = self.get_current_server_datetime()
        return self.compute_inactive_duration_seconds(current_server_date, last_sunshine_activity_datetime, machine_start_datetime)

# For testing
class DummySunshineActivityChecker(SunshineActivityChecker):

    def __init__(self, sunshine_logs, sunshine_timezone, machine_start_datetime_str, current_server_datetime_str):
        self.sunshine_logs = sunshine_logs
        self.sunshine_timezone = sunshine_timezone
        self.machine_start_datetime = datetime.strptime(machine_start_datetime_str, '%Y-%m-%d %H:%M:%S%z')
        self.current_server_datetime = datetime.strptime(current_server_datetime_str, '%Y-%m-%d %H:%M:%S%z')

    def get_sunshine_logs(self):
        return self.sunshine_logs

    def get_sunshine_timezone(self):
        return self.sunshine_timezone

    def get_current_machine_start_time(self):
        return self.machine_start_datetime

    def get_current_server_datetime(self):
        return self.current_server_datetime

def main():

    # Set the inactivity timeout (in seconds)
    # Default to 15 minutes if not set
    inactivity_timeout = int(os.getenv('CLOUDYPAD_AUTOSTOP_TIMEOUT', 15*60)) 

    # Period between each check (in seconds)
    # Default to 1 minute if not set
    check_period_seconds = int(os.getenv('CLOUDYPAD_AUTOSTOP_CHECK_PERIOD_SECONDS', 60))

    print(f"Starting Cloudy Pad Autostop")
    print(f"Inactivity timeout: {inactivity_timeout} seconds")
    print(f"Check period: {check_period_seconds} seconds")

    # Dry run mode
    dry_run = os.getenv('CLOUDYPAD_AUTOSTOP_DRY_RUN', 'false').lower() in ('true', '1')

    checker = SunshineActivityChecker()

    while True:
        try:
            inactive_duration = checker.get_inactive_duration_seconds()
            print(f"Inactivity duration: {inactive_duration} seconds")

            if inactive_duration >= inactivity_timeout:
                print(f"Inactivity timeout reached: {inactive_duration} seconds. Shutting down the instance.")
                if dry_run:
                    print("Would shutdown the instance. Continuing as running in dry run mode...")
                else:
                    print("Inactivity timeout detected. Shutting down the machine...")
                    subprocess.run(['sudo', 'shutdown', '-h', 'now'], check=True)
                    break

        except Exception as e:
            print(f"Error checking inactivity: {e}")

        time.sleep(check_period_seconds)

if __name__ == "__main__":
    main()

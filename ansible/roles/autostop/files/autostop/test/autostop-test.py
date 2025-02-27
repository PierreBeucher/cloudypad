import os
import sys
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '../src'))
from autostop import DummySunshineActivityChecker

# Various simple test to ensure our inactivity detecter works
# May be reworked into proper unit tests
if __name__ == "__main__":

    sunshine_log_disconnected_2025_02_06_14_41_16 = os.path.join(os.path.dirname(__file__), "sunshine/disconnected-2025-02-06-14-41-16.log")
    sunshine_log_started_2025_02_09_12_17_06 = os.path.join(os.path.dirname(__file__), "sunshine/started-2025-02-09-12-17-06.log")
    sunshine_log_connected_2025_02_06_13_10_13 = os.path.join(os.path.dirname(__file__), "sunshine/connected-2025-02-06-13-10-13.log")

    # Sunshine started after machine
    # Shoild consider Sunshine activity time from current time
    checker1 = DummySunshineActivityChecker(
        sunshine_logs=sunshine_log_started_2025_02_09_12_17_06,
        sunshine_timezone="+0100",
        machine_start_datetime_str="2025-02-09 12:16:50+0100",
        current_server_datetime_str="2025-02-09 12:17:20+0100"
    )
    inactive_duration = checker1.get_inactive_duration_seconds()
    
    assert inactive_duration == 13, f"Expected inactive duration to be 13s, but got {inactive_duration}s"
    
    # Last sunshine connection predates machine current boot
    # Should consider last activity at machine boot
    checker2 = DummySunshineActivityChecker(
        sunshine_logs=sunshine_log_started_2025_02_09_12_17_06,
        sunshine_timezone="+0100",
        machine_start_datetime_str="2025-02-09 14:20:50+0100",
        current_server_datetime_str="2025-02-09 14:30:50+0100"
    )
    inactive_duration = checker2.get_inactive_duration_seconds()
    
    assert inactive_duration == 600, f"Expected inactive duration to be 600s, but got {inactive_duration}s"
    
    # Currently active user, no inactivity time
    checker3 = DummySunshineActivityChecker(
        sunshine_logs=sunshine_log_connected_2025_02_06_13_10_13,
        sunshine_timezone="+0100",
        machine_start_datetime_str="2025-02-06 13:08:50+0100",
        current_server_datetime_str="2025-02-06 13:15:50+0100"
    )
    inactive_duration = checker3.get_inactive_duration_seconds()
    
    assert inactive_duration == 0, f"Expected inactive duration to be 0s, but got {inactive_duration}s"

    # Disconnected user
    checker4 = DummySunshineActivityChecker(
        sunshine_logs=sunshine_log_disconnected_2025_02_06_14_41_16,
        sunshine_timezone="+0100",
        machine_start_datetime_str="2025-02-06 13:50:50+0100",
        current_server_datetime_str="2025-02-06 14:46:17+0100"
    )
    inactive_duration = checker4.get_inactive_duration_seconds()
    
    assert inactive_duration == 300, f"Expected inactive duration to be 300s, but got {inactive_duration}s"

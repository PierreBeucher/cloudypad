# Google Cloud monthly cost estimations

Cloudy-Pad is free and open-source; however, charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

**💸 It's recommenced to use Spot instances as they are 30% to 90% cheaper !** As Spot instances interrupton is generally low, you probably won't get interruped during your session. However, make sure to save often nonetheless 😉

Example: using a n1-standard-4 (15 GB RAM, 4 CPUs, NVIDIA T4) Spot instance with 100 GB disk for 10 hours / month would cost approximatively 11.54$ / month. 

| Instance type | RAM (GB) | CPUs |    GPU    | Spot ? | Disk size | Instance $ / h | GPU $ / h | h /  month | Compute $ / month | Disk $ / month | Total $ / month |
|:-------------:|:--------:|:----:|:---------:|:------:|:---------:|:--------------:|:---------:|:----------:|:-----------------:|:--------------:|:---------------:|
| n1-standard-4 |    15    |   4  | NVIDIA T4 |   Yes  |    100    |     $0.035     |   0.119   |     10     |       $1.54       |     $10.00     |      $11.54     |
| n1-standard-8 |    30    |   8  | NVIDIA T4 |   Yes  |    100    |     $0.070     |   0.119   |     30     |       $5.68       |     $10.00     |      $15.68     |
| n1-standard-8 |    30    |   8  | NVIDIA T4 |   Yes  |    250    |     $0.070     |   0.119   |     30     |       $5.68       |     $25.00     |      $30.68     |
| n1-standard-8 |    30    |   8  | NVIDIA P4 |   Yes  |    100    |     $0.070     |   0.240   |     30     |       $9.31       |     $10.00     |      $19.31     |
| n1-standard-8 |    30    |   8  | NVIDIA P4 |   Yes  |    250    |     $0.070     |   0.240   |     30     |       $9.31       |     $25.00     |      $34.31     |
| n1-standard-4 |    15    |   4  | NVIDIA T4 |   No   |    100    |     $0.220     |   0.350   |     10     |       $5.70       |     $10.00     |      $15.70     |
| n1-standard-8 |    30    |   8  | NVIDIA T4 |   No   |    100    |     $0.440     |   0.350   |     30     |       $23.70      |     $10.00     |      $33.70     |
| n1-standard-8 |    30    |   8  | NVIDIA T4 |   No   |    250    |     $0.440     |   0.350   |     30     |       $23.70      |     $25.00     |      $48.70     |
| n1-standard-8 |    30    |   8  | NVIDIA P4 |   No   |    100    |     $0.440     |   0.600   |     30     |       $31.20      |     $10.00     |      $41.20     |
| n1-standard-8 |    30    |   8  | NVIDIA P4 |   No   |    250    |     $0.440     |   0.600   |     30     |       $31.20      |     $25.00     |      $56.20     |

_Instances used for estimation: N1 Standard. Estimations based on Google Cloud us-central-1 as of September 2024. Exact prices may vary over time and by region._

# Google Cloud Platform costs

## Monthly cost estimations

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

_Instances used for estimation: N1 Standard. Estimations based on Google Cloud [on-demand](https://cloud.google.com/compute/vm-instance-pricing#general-purpose_machine_type_family) and [spot](https://cloud.google.com/spot-vms/pricing) us-central-1 as of September 2024. Exact prices may vary over time and by region._

## Egress costs - Data transfer out from Google to Internet

Google bills data transfer out to internet past a **200GB free data threshold**. As Cloudy Pad streams from Google to your machine via internet, you may be billed for data transfer past a certain usage. [Google bills 0.085$ per GB](https://cloud.google.com/vpc/network-pricing#vpc-pricing) up to 10 TB after the free threshold. 

Considering a 1080p 60 FPS stream, data transfer would be around 2.25 GB/hr. **Past 90 or 100 hours per month**, Google may start billing additional data transfer charges:

| Time played / month (h) |   10  |   20  |   40  |   80   |   90   |   100  |   150  |
|:-----------------------:|:-----:|:-----:|:-----:|:------:|:------:|:------:|:------:|
|   Data transfered (GB)  | 22.50 | 45.00 | 90.00 | 180.00 | 202.50 | 225.00 | 337.50 |
|        Cost  ($)        | $0.00 | $0.00 | $0.00 |  $0.00 |  $0.21 |  $2.13 | $11.69 |
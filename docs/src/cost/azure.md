# Azure monthly cost estimations

Cloudy-Pad is free and open-source; however, charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

**💸 It's recommenced to use Spot instances as they are 30% to 90% cheaper !** As Spot instances interrupton is generally low, you probably won't get interruped during your session. However, make sure to save often nonetheless 😉

Example: using an NV6ads A10 v5 (35 GB RAM, 6 CPUs, 1/6 NVIDIA A10) Spot instance with 100 GB disk for 10 hours / month would cost approximatively 9.24$ / month. 

| Instance type | RAM (GB) | CPUs |       GPU      | Spot ? | Disk size | Instance $ / h | h /  month | Compute $ / month | Disk / month $ | Total $ / month |
|:-------------:|:--------:|:----:|:--------------:|:------:|:---------:|:--------------:|:----------:|:-----------------:|:--------------:|:---------------:|
| NV6ads A10 v5 |    55    |   6  | 1/6 NVIDIA A10 |   Yes  |    100    |     $0.114     |     10     |       $1.14       |      $8.10     |      $9.24      |
|  NC8as T4 v3  |    56    |   8  |    NVIDIA T4   |   Yes  |    100    |     $0.099     |     30     |       $2.96       |      $8.10     |      $11.06     |
|  NC16as T4 v3 |    110   |  16  |    NVIDIA T4   |   Yes  |    250    |     $0.158     |     30     |       $4.73       |     $20.25     |      $24.98     |
| NV6ads A10 v5 |    55    |   6  | 1/6 NVIDIA A10 |   No   |    100    |     $0.454     |     30     |       $13.62      |      $8.10     |      $21.72     |
|  NC8as T4 v3  |    56    |   8  |    NVIDIA T4   |   No   |    100    |     $0.752     |     30     |       $22.56      |      $8.10     |      $30.66     |
|  NC16as T4 v3 |    110   |  16  |    NVIDIA T4   |   No   |    250    |     $1.200     |     30     |       $36.00      |     $20.25     |      $56.25     |

_*Estimations based on Azure US pricing as of September 2024. Exact prices may vary over time and by region._

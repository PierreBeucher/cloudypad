# Azure costs

## Monthly cost estimations

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

## Egress costs - Data transfer out from Azure to Internet

Azure bills data transfer out to internet past a 100GB free data threshold. As Cloudy Pad streams from Azure to your machine via internet, you may be billed for data transfer past a certain usage. [Azure bills 0.08$ to 0.12$ per GB depending on your localisation](https://azure.microsoft.com/en-us/pricing/details/bandwidth/) after the free threshold. 

Considering a 1080p 60 FPS stream at 15 Mbps, data transfer would be around 6.75 GB/hr, incuring additional cost depending on time played:

| Time played / month (h) |   10  |   20   |   40   |   50   |   60   |   100  |
|:-----------------------:|:-----:|:------:|:------:|:------:|:------:|:------:|
|   Data transfered (GB)  | 67.50 | 135.00 | 270.00 | 337.50 | 405.00 | 675.00 |
|        Cost  ($)        | $0.00 |  $2.80 | $13.60 | $19.00 | $24.40 | $46.00 |
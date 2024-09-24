# AWS monthly cost estimations

Cloudy-Pad is free and open-source; however, charges may apply when using a Cloud provider. Typically billed resources:
- Machine usage (GPU, CPU, RAM)
- Disk storage
- IP address reservation

**💸 It's recommenced to use Spot instances as they are 30% to 90% cheaper !** As Spot instances interrupton is generally low, you probably won't get interruped during your session. However, make sure to save often nonetheless 😉

Example: using a g4dn.xlarge (16 GB RAM, 4 CPUs, NVIDIA T4) Spot instance for 10 hours / month would cost approximatively 9.63$ / month. 

| Instance type | RAM (GB) | CPUs |     GPU     | Spot ? | Disk size | Instance $ / h | h /  month | Compute $ / month | Disk / month $ | Total $ / month |
|:-------------:|:--------:|:----:|:-----------:|:------:|:---------:|:--------------:|:----------:|:-----------------:|:--------------:|:---------------:|
|  g4dn.xlarge  |    16    |   4  |  NVIDIA T4  |   Yes  |    100    |     $0.163     |     10     |       $1.63       |      $8.00     |      $9.63      |
|  g4dn.2xlarge |    32    |   8  |  NVIDIA T4  |   Yes  |    100    |     $0.256     |     30     |       $7.67       |      $8.00     |      $15.67     |
|   g5.2xlarge  |    32    |   8  | NVIDIA A10G |   Yes  |    250    |     $0.412     |     30     |       $12.36      |     $20.00     |      $32.36     |
|   g6.2xlarge  |    32    |   8  |  NVIDIA L4  |   Yes  |    250    |     $0.391     |     30     |       $11.73      |     $20.00     |      $31.73     |
|  g4dn.xlarge  |    16    |   4  |  NVIDIA T4  |   No   |    100    |     $0.526     |     10     |       $5.26       |      $8.00     |      $13.26     |
|  g4dn.2xlarge |    32    |   8  |  NVIDIA T4  |   No   |    100    |     $0.752     |     30     |       $22.56      |      $8.00     |      $30.56     |
|   g5.2xlarge  |    32    |   8  | NVIDIA A10G |   No   |    250    |     $1.212     |     30     |       $36.36      |     $20.00     |      $56.36     |
|   g6.2xlarge  |    32    |   8  |  NVIDIA L4  |   No   |    250    |     $0.978     |     30     |       $29.33      |     $20.00     |      $49.33     |

_*Estimations based on AWS eu-east-1 pricing as of September 2024. Exact prices may vary over time and by region._

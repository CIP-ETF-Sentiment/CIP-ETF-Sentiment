from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from urllib.parse import quote
from pathlib import Path

import pandas as pd
import time
import random


from pathlib import Path


keywords = ['航運ETF', '能源ETF', '金融ETF', '5G ETF']
download_folder = "/Users/timmochou/workspace/CIP/ETF/test.py"

for i, keyword in enumerate(keywords[:10], start=1):
    print(i, keyword)


options = Options()

# 保持瀏覽器開啟
options.add_experimental_option("detach", True)

# 最大化
options.add_argument("--start-maximized")

# 建立 Chrome
driver = webdriver.Chrome(options=options)

wait = WebDriverWait(driver, 20)

driver.get("https://trends.google.com/trends/")

print("Chrome 已成功啟動")


def wait_for_new_csv(before_files, timeout=20):

    start_time = time.time()

    while time.time() - start_time < timeout:

        temp_files = list(
            download_folder.glob("*.crdownload")
        )

        after_files = set(
            download_folder.glob("*.csv")
        )

        new_files = after_files - before_files

        # 有新 CSV，而且沒有尚未下載完成的檔案
        if new_files and not temp_files:

            latest_csv = max(
                new_files,
                key=lambda x: x.stat().st_mtime
            )

            return latest_csv

        time.sleep(1)

    return None

def download_google_trends(keyword):

    print()
    print("=" * 50)
    print(f"開始下載：{keyword}")
    print("=" * 50)

    # --------------------------------------------------
    # 1. 建立 Google Trends URL
    # 台灣、過去 5 年
    # --------------------------------------------------

    url = (
        "https://trends.google.com/trends/explore"
        "?date=today%205-y"
        "&geo=TW"
        f"&q={quote(keyword)}"
    )

    # --------------------------------------------------
    # 2. 開啟 Google Trends
    # --------------------------------------------------

    driver.get(url)

    # Google Trends 是動態網站，先等待載入
    time.sleep(8)

    print("目前頁面：", driver.title)

    # --------------------------------------------------
    # 3. 找到 TIMESERIES 區塊
    # --------------------------------------------------

    try:

        timeseries_widget = wait.until(
            EC.presence_of_element_located(
                (
                    By.CSS_SELECTOR,
                    'trends-widget[widget-name="TIMESERIES"]'
                )
            )
        )

    except Exception:

        print(f"❌ 找不到 TIMESERIES 區塊：{keyword}")
        return False

    # --------------------------------------------------
    # 4. 找到 TIMESERIES 裡面的 CSV 按鈕
    # --------------------------------------------------

    try:

        csv_button = timeseries_widget.find_element(
            By.CSS_SELECTOR,
            'button[title="CSV"]'
        )

    except Exception:

        print(f"❌ 找不到 TIMESERIES CSV：{keyword}")
        return False

    print("✅ 已找到 TIMESERIES CSV")

    # 把 CSV 按鈕移到畫面中央
    driver.execute_script(
        """
        arguments[0].scrollIntoView(
            {block: 'center'}
        );
        """,
        csv_button
    )

    time.sleep(2)

    # --------------------------------------------------
    # 5. 紀錄下載前已有的 CSV
    # --------------------------------------------------

    before_files = set(
        download_folder.glob("*.csv")
    )

    # --------------------------------------------------
    # 6. 點擊 TIMESERIES CSV
    # --------------------------------------------------

    try:

        driver.execute_script(
            "arguments[0].click();",
            csv_button
        )

    except Exception as e:

        print(f"❌ 無法點擊 TIMESERIES CSV：{keyword}")
        print(e)

        return False

    print("已點擊 TIMESERIES CSV")

    # --------------------------------------------------
    # 7. 等待下載完成
    # --------------------------------------------------

    latest_csv = wait_for_new_csv(
        before_files,
        timeout=20
    )

    if latest_csv is None:

        print(f"❌ 沒有偵測到新 CSV：{keyword}")
        return False

    print("下載檔案：", latest_csv.name)

    # --------------------------------------------------
    # 8. 設定新檔名
    # --------------------------------------------------

    new_file = (
        download_folder /
        f"{keyword}.csv"
    )

    # 如果之前已經下載過相同 Keyword
    if new_file.exists():
        new_file.unlink()

    # --------------------------------------------------
    # 9. 改名
    # --------------------------------------------------

    latest_csv.rename(new_file)

    print(f"✅ 完成：{new_file.name}")

    return True

# %% [markdown]
# ### 正式下載 Keyword

# %%
success_keywords = []
failed_keywords = []

for i, keyword in enumerate(keywords, start=1):

    print()
    print(f"[{i}/{len(keywords)}] {keyword}")

    success = download_google_trends(keyword)

    if success:
        success_keywords.append(keyword)
    else:
        failed_keywords.append(keyword)

    # 避免太密集操作 Google Trends
    time.sleep(5)

print()
print("=" * 50)
print("下載完成")
print("=" * 50)

print("成功數量：", len(success_keywords))
print("失敗數量：", len(failed_keywords))

print()
print("失敗 Keyword：")
print(failed_keywords)

# %% [markdown]
# ### 合併資料

# %%
merged_df = None

for keyword in success_keywords:

    file_path = download_folder / f"{keyword}.csv"

    # Google Trends CSV 前兩行是說明文字
    df = pd.read_csv(
        file_path,
        skiprows=2
    )

    # 只取前兩欄：日期 + 該 Keyword 的搜尋熱度
    df = df.iloc[:, :2].copy()

    # 統一欄名
    df.columns = [
        "Date",
        keyword
    ]

    # 日期轉成 datetime
    df["Date"] = pd.to_datetime(
        df["Date"],
        errors="coerce"
    )

    # 去除無法辨識的日期
    df = df.dropna(
        subset=["Date"]
    )

    # 第一個 Keyword 直接當基底
    if merged_df is None:

        merged_df = df

    else:

        merged_df = pd.merge(
            merged_df,
            df,
            on="Date",
            how="outer"
        )

# 依日期排序
merged_df = merged_df.sort_values(
    "Date"
).reset_index(drop=True)

print("合併完成")
print("資料筆數：", len(merged_df))
print("Keyword 數量：", len(merged_df.columns) - 1)

merged_df.head()

# %% [markdown]
# # 2026 年哪些搜尋需求相較於自己的歷史水準明顯升高？

# %%
#  找出 ETF 市場需求目前正在升溫的是什麼 
#  第一層：現在熱不熱？ → 第二層：比自己過去熱多少？ → 第三層：最近是在升溫還是降溫？

# %%
monthly_df = (
    merged_df
    .set_index("Date")
    .resample("ME")
    .mean()
    .reset_index()
)

print("月頻資料筆數：", len(monthly_df))
print("Keyword 數量：", len(monthly_df.columns) - 1)

monthly_df.head()

# %% [markdown]
# ## 切 Historical 2021~2025 與 Current 2026

# %%
historical_df = monthly_df[
    monthly_df["Date"].dt.year < 2026
].copy()

current_df = monthly_df[
    monthly_df["Date"].dt.year == 2026
].copy()

print("歷史月份數：", len(historical_df))
print("2026 月份數：", len(current_df))

# %% [markdown]
# ## 算每個 Keyword 的「歷史正常水準」

# %%
keyword_columns = [
    col for col in monthly_df.columns
    if col != "Date"
]

historical_stats = pd.DataFrame({
    "Keyword": keyword_columns,
    "Historical_Mean": [
        historical_df[col].mean()
        for col in keyword_columns
    ],
    "Historical_Std": [
        historical_df[col].std()
        for col in keyword_columns
    ]
})

historical_stats.head()

# %% [markdown]
# ## 計算 2026 的平均熱度

# %%
current_stats = pd.DataFrame({
    "Keyword": keyword_columns,
    "Mean_2026": [
        current_df[col].mean()
        for col in keyword_columns
    ]
})

current_stats.head()

# %%
analysis_df = pd.merge(
    historical_stats,
    current_stats,
    on="Keyword",
    how="left"
)

analysis_df.head()

# %% [markdown]
# ## 計算 Z-score

# %%
analysis_df["Z_2026"] = (
    analysis_df["Mean_2026"]- analysis_df["Historical_Mean"]) / analysis_df["Historical_Std"]

analysis_df = analysis_df.sort_values(
    "Z_2026",
    ascending=False
).reset_index(drop=True)

analysis_df[
    [
        "Keyword",
        "Historical_Mean",
        "Mean_2026",
        "Z_2026"
    ]
].head(10)

# %% [markdown]
# ## Baseline 品質判斷

# %%
analysis_df["Low_Baseline"] = (analysis_df["Historical_Mean"] < 5)
analysis_df["Emerging"] = ((analysis_df["Historical_Mean"] < 5)& (analysis_df["Mean_2026"] >= 10))

# %%
# 相較 2021~2025 年，2026 頻繁出現的詞彙

analysis_df[
    analysis_df["Emerging"]
][
    [
        "Keyword",
        "Historical_Mean",
        "Mean_2026",
        "Z_2026"
    ]
].sort_values(
    "Mean_2026",
    ascending=False
)

# %%
# 相較 2021~2025 年出現已頻繁的詞彙於 2026 的熱度

mature_df = analysis_df[
    ~analysis_df["Low_Baseline"]
].copy()

mature_df = mature_df.sort_values(
    "Z_2026",
    ascending=False
)

mature_df[
    [
        "Keyword",
        "Historical_Mean",
        "Mean_2026",
        "Z_2026"
    ]
].head(15)

recent_3m_df = (            # 取最近 3 個月
    monthly_df
    .sort_values("Date")
    .tail(3)
)

print("最近 3 個月：")
print(recent_3m_df["Date"])


recent_stats = pd.DataFrame({
    "Keyword": keyword_columns,
    "Recent_3M_Mean": [
        recent_3m_df[col].mean()
        for col in keyword_columns
    ]
})

analysis_df = pd.merge(
    analysis_df,
    recent_stats,
    on="Keyword",
    how="left"
)

analysis_df["Recent_Z"] = (analysis_df["Recent_3M_Mean"]- analysis_df["Historical_Mean"]
) / analysis_df["Historical_Std"]

analysis_df[
    [
        "Keyword",
        "Historical_Mean",
        "Mean_2026",
        "Recent_3M_Mean",
        "Z_2026",
        "Recent_Z"
    ]
].sort_values(
    "Recent_Z",
    ascending=False
).head(50)



"""
CAO TOAN BO COMMENT YOUTUBE - CO RESUME KHI HET QUOTA
=======================================================

Yeu cau truoc khi chay:
    pip install google-api-python-client

Cach dung:
    python cao_comment_resume.py

Neu dang chay ma het quota (10.000 unit/ngay), script se:
    - Tu dong phat hien loi het quota
    - Luu lai CHINH XAC vi tri dang dung (dang o trang comment top nao,
      dang o giua phan lay reply cua comment nao, da lay den dau)
    - Thoat chuong trinh voi thong bao ro rang

Ngay hom sau (hoac khi quota duoc reset), chi can CHAY LAI SCRIPT VOI
CUNG VIDEO, chuong trinh se tu dong doc checkpoint va TIEP TUC dung
tu cho dung, KHONG chay lai tu dau, KHONG ghi du lieu bi lap.

File ket qua (dat ten theo video_id, khong doi theo ngay, de resume
dung file cu):
    - checkpoint_<video_id>.json   -> trang thai de resume (dung xoa khi
                                       chua cao xong)
    - comments_raw_<video_id>.jsonl -> du lieu tho, moi dong 1 comment top
                                        kem toan bo reply cua no
    - comments_flat_<video_id>.csv  -> dang bang phang, co cot parent_id
    - comments_tree_<video_id>.json -> file CAY hoan chinh, CHI duoc tao
                                        khi cao XONG TOAN BO video
"""

import csv
import json
import os
import sys
import time
from urllib.parse import urlparse, parse_qs

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Chua cai thu vien. Chay lenh sau roi thu lai:")
    print("    pip install google-api-python-client")
    sys.exit(1)


def lay_video_id(url: str) -> str:
    url = url.strip()
    parsed = urlparse(url)
    if "youtu.be" in parsed.netloc:
        return parsed.path.lstrip("/")
    if "youtube.com" in parsed.netloc:
        qs = parse_qs(parsed.query)
        if "v" in qs:
            return qs["v"][0]
        parts = parsed.path.split("/")
        if len(parts) >= 3 and parts[1] in ("shorts", "embed", "live"):
            return parts[2]
    if len(url) == 11:
        return url
    raise ValueError("Khong nhan dien duoc video ID tu link da nhap.")


def duong_dan(video_id, ten, duoi):
    return f"{ten}_{video_id}.{duoi}"


def doc_checkpoint(cp_path):
    if os.path.exists(cp_path):
        with open(cp_path, encoding="utf-8") as f:
            return json.load(f)
    return None


def luu_checkpoint(cp_path, state):
    tmp = cp_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, cp_path)


def la_loi_het_quota(e: HttpError) -> bool:
    try:
        status = e.resp.status
        content = e.content.decode("utf-8") if isinstance(e.content, bytes) else str(e.content)
    except Exception:
        return False
    tu_khoa = ("quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded")
    return status in (403, 429) and any(k in content for k in tu_khoa)


def khoi_tao_csv(csv_path):
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["id", "parent_id", "author", "text", "like_count",
                    "published_at", "updated_at", "total_reply_count"])


def ghi_record(jsonl_path, csv_path, record):
    with open(jsonl_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    with open(csv_path, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([
            record["comment_id"], "", record["author"], record["text"],
            record["like_count"], record["published_at"], record["updated_at"],
            record["total_reply_count"],
        ])
        for r in record["replies"]:
            w.writerow([
                r["reply_id"], r["parent_id"], r["author"], r["text"],
                r["like_count"], r["published_at"], r["updated_at"], "",
            ])


def tao_snippet_top(item):
    sn = item["snippet"]["topLevelComment"]["snippet"]
    return {
        "comment_id": item["id"],
        "author": sn.get("authorDisplayName", ""),
        "text": sn.get("textDisplay", "").replace("\n", " "),
        "like_count": sn.get("likeCount", 0),
        "published_at": sn.get("publishedAt", ""),
        "updated_at": sn.get("updatedAt", ""),
        "total_reply_count": item["snippet"]["totalReplyCount"],
    }


def tao_snippet_reply(item, parent_id):
    sn = item["snippet"]
    return {
        "reply_id": item["id"],
        "parent_id": parent_id,
        "author": sn.get("authorDisplayName", ""),
        "text": sn.get("textDisplay", "").replace("\n", " "),
        "like_count": sn.get("likeCount", 0),
        "published_at": sn.get("publishedAt", ""),
        "updated_at": sn.get("updatedAt", ""),
    }


def lay_dan_reply_con_thieu(youtube, top_id, da_co, page_token_da_luu, state, cp_path):
    """Lay tiep reply con thieu, co the resume dung tu trang reply dang do."""
    replies = list(da_co)
    page_token = page_token_da_luu

    while True:
        try:
            resp = youtube.comments().list(
                part="snippet", parentId=top_id, maxResults=100,
                pageToken=page_token, textFormat="plainText",
            ).execute()
        except HttpError as e:
            if la_loi_het_quota(e):
                state["dang_do_reply"]["collected"] = replies
                state["dang_do_reply"]["page_token"] = page_token
                luu_checkpoint(cp_path, state)
                print("\n[HET QUOTA] Da luu dung vi tri dung (dang o giua "
                      "phan lay reply). Chay lai script sau (vd: ngay mai) "
                      "de tiep tuc dung cho, khong lap du lieu.")
                sys.exit(0)
            raise

        for it in resp.get("items", []):
            replies.append(tao_snippet_reply(it, top_id))

        page_token = resp.get("nextPageToken")
        state["dang_do_reply"]["collected"] = replies
        state["dang_do_reply"]["page_token"] = page_token
        luu_checkpoint(cp_path, state)

        if not page_token:
            break
        time.sleep(0.05)

    return replies


def cao_comment(api_key: str, video_url: str):
    video_id = lay_video_id(video_url)
    youtube = build("youtube", "v3", developerKey=api_key)

    cp_path = duong_dan(video_id, "checkpoint", "json")
    jsonl_path = duong_dan(video_id, "comments_raw", "jsonl")
    csv_path = duong_dan(video_id, "comments_flat", "csv")
    tree_path = duong_dan(video_id, "comments_tree", "json")

    state = doc_checkpoint(cp_path)

    if state is None:
        state = {
            "video_id": video_id,
            "next_top_page_token": None,
            "trang_dang_xu_ly": None,
            "dang_do_reply": None,
            "hoan_tat": False,
            "thong_ke": {"so_top": 0, "so_reply": 0},
        }
        khoi_tao_csv(csv_path)
        open(jsonl_path, "w", encoding="utf-8").close()
        luu_checkpoint(cp_path, state)
        print(f"Bat dau cao MOI cho video: {video_id}")
    else:
        if state.get("hoan_tat"):
            print("Video nay da duoc cao XONG HOAN TOAN o lan chay truoc.")
            print(f"  -> Xem ket qua tai: {tree_path} va {csv_path}")
            print(f"Neu muon cao lai tu dau, xoa cac file '{cp_path}', "
                  f"'{jsonl_path}', '{csv_path}' roi chay lai.")
            return
        print(f"Phat hien tien trinh do dang cho video {video_id} "
              "-> TIEP TUC tu dung cho dung, KHONG chay lai tu dau.")
        print(f"  Da lay truoc do: {state['thong_ke']['so_top']} comment top, "
              f"{state['thong_ke']['so_reply']} reply.")

    if state.get("dang_do_reply"):
        dd = state["dang_do_reply"]
        top_comment = dd["top_comment"]
        print(f"Tiep tuc lay not reply cho comment: {top_comment['text'][:40]}...")
        full_replies = lay_dan_reply_con_thieu(
            youtube, top_comment["comment_id"], dd["collected"],
            dd["page_token"], state, cp_path
        )
        record = dict(top_comment)
        record["replies"] = full_replies
        ghi_record(jsonl_path, csv_path, record)
        state["thong_ke"]["so_top"] += 1
        state["thong_ke"]["so_reply"] += len(full_replies)
        state["dang_do_reply"] = None
        if state.get("trang_dang_xu_ly"):
            state["trang_dang_xu_ly"]["so_da_xong"] += 1
        luu_checkpoint(cp_path, state)

    while True:
        if state.get("trang_dang_xu_ly"):
            token_goi = state["trang_dang_xu_ly"]["page_token_dung"]
            bo_qua = state["trang_dang_xu_ly"]["so_da_xong"]
        else:
            token_goi = state["next_top_page_token"]
            bo_qua = 0

        try:
            resp = youtube.commentThreads().list(
                part="snippet,replies", videoId=video_id, maxResults=100,
                order="time", textFormat="plainText", pageToken=token_goi,
            ).execute()
        except HttpError as e:
            if la_loi_het_quota(e):
                if not state.get("trang_dang_xu_ly"):
                    state["trang_dang_xu_ly"] = {"page_token_dung": token_goi, "so_da_xong": 0}
                luu_checkpoint(cp_path, state)
                print("\n[HET QUOTA] Da luu vi tri dung. Chay lai script sau "
                      "(vd: ngay mai khi quota duoc reset) de tiep tuc dung "
                      "cho, khong mat va khong lap du lieu.")
                sys.exit(0)
            if "commentsDisabled" in str(e):
                print("Video nay da tat binh luan.")
                state["hoan_tat"] = True
                luu_checkpoint(cp_path, state)
                return
            raise

        items = resp.get("items", [])
        state["trang_dang_xu_ly"] = {"page_token_dung": token_goi, "so_da_xong": bo_qua}
        luu_checkpoint(cp_path, state)

        for idx in range(bo_qua, len(items)):
            item = items[idx]
            top_comment = tao_snippet_top(item)
            top_id = top_comment["comment_id"]
            total = top_comment["total_reply_count"]

            reply_co_san = [
                tao_snippet_reply(r, top_id)
                for r in item.get("replies", {}).get("comments", [])
            ]

            if total > len(reply_co_san):
                state["dang_do_reply"] = {
                    "top_comment": top_comment,
                    "collected": reply_co_san,
                    "page_token": None,
                }
                luu_checkpoint(cp_path, state)
                full_replies = lay_dan_reply_con_thieu(
                    youtube, top_id, reply_co_san, None, state, cp_path
                )
                state["dang_do_reply"] = None
            else:
                full_replies = reply_co_san

            record = dict(top_comment)
            record["replies"] = full_replies
            ghi_record(jsonl_path, csv_path, record)

            state["thong_ke"]["so_top"] += 1
            state["thong_ke"]["so_reply"] += len(full_replies)
            state["trang_dang_xu_ly"]["so_da_xong"] = idx + 1
            luu_checkpoint(cp_path, state)

            if state["thong_ke"]["so_top"] % 50 == 0:
                print(f"Da xu ly {state['thong_ke']['so_top']} comment top "
                      f"({state['thong_ke']['so_reply']} reply)...")

        next_token = resp.get("nextPageToken")
        state["next_top_page_token"] = next_token
        state["trang_dang_xu_ly"] = None
        luu_checkpoint(cp_path, state)

        if not next_token:
            break
        time.sleep(0.05)

    state["hoan_tat"] = True
    luu_checkpoint(cp_path, state)

    da_thay_id = set()
    cay = []
    with open(jsonl_path, encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec["comment_id"] in da_thay_id:
                continue
            da_thay_id.add(rec["comment_id"])
            seen_reply = set()
            reply_loc = []
            for r in rec["replies"]:
                if r["reply_id"] in seen_reply:
                    continue
                seen_reply.add(r["reply_id"])
                reply_loc.append(r)
            rec["replies"] = reply_loc
            cay.append(rec)

    with open(tree_path, "w", encoding="utf-8") as out:
        json.dump(cay, out, ensure_ascii=False, indent=2)

    tong_reply = sum(len(c["replies"]) for c in cay)
    print(f"\n=== HOAN TAT TOAN BO ===")
    print(f"Tong comment top: {len(cay)}")
    print(f"Tong reply: {tong_reply}")
    print(f"Tong cong: {len(cay) + tong_reply}")
    print(f"File cay (JSON): {tree_path}")
    print(f"File phang (CSV): {csv_path}")


if __name__ == "__main__":
    api_key = input("Nhap API key: ").strip()
    video_url = input("Dan link video YouTube: ").strip()
    if not api_key or not video_url:
        print("Thieu thong tin.")
        sys.exit(1)
    try:
        cao_comment(api_key, video_url)
    except KeyboardInterrupt:
        print("\nDa dung theo yeu cau. Tien trinh da duoc luu, chay lai "
              "script de tiep tuc tu cho dung.")

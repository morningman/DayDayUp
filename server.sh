#!/bin/bash
# ============================================
# Shawn 每日学习计划 - 服务管理脚本
# ============================================

PORT=8080
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/.server.pid"
LOG_FILE="$APP_DIR/.server.log"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${CYAN}"
    echo "  ╔═══════════════════════════════════╗"
    echo "  ║   🌟 Shawn 每日学习计划 🌟        ║"
    echo "  ╚═══════════════════════════════════╝"
    echo -e "${NC}"
}

# 获取运行中的 PID
get_pid() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        # 检查进程是否仍在运行
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        else
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# 启动
do_start() {
    local pid
    if pid=$(get_pid); then
        echo -e "${YELLOW}⚠️  服务已在运行中（PID: $pid）${NC}"
        echo -e "   访问地址: ${GREEN}http://localhost:${PORT}${NC}"
        return 1
    fi

    echo -e "${CYAN}🚀 正在启动服务...${NC}"
    cd "$APP_DIR" || exit 1
    nohup python3 "$APP_DIR/server.py" > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1

    if pid=$(get_pid); then
        echo -e "${GREEN}✅ 服务已启动（PID: $pid）${NC}"
        echo -e "   访问地址: ${GREEN}http://localhost:${PORT}${NC}"
    else
        echo -e "${RED}❌ 启动失败，请检查日志: $LOG_FILE${NC}"
        return 1
    fi
}

# 停止
do_stop() {
    local pid
    if pid=$(get_pid); then
        echo -e "${CYAN}🛑 正在停止服务（PID: $pid）...${NC}"
        kill "$pid" 2>/dev/null
        sleep 1
        # 如果还没停，强制杀
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        echo -e "${GREEN}✅ 服务已停止${NC}"
    else
        echo -e "${YELLOW}⚠️  服务未在运行${NC}"
    fi
}

# 重启
do_restart() {
    echo -e "${CYAN}🔄 正在重启服务...${NC}"
    do_stop
    sleep 1
    do_start
}

# 状态
do_status() {
    local pid
    if pid=$(get_pid); then
        echo -e "${GREEN}✅ 服务运行中（PID: $pid）${NC}"
        echo -e "   访问地址: ${GREEN}http://localhost:${PORT}${NC}"
    else
        echo -e "${RED}⭕ 服务未运行${NC}"
    fi
}

# 查看日志
do_log() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${CYAN}📋 最近日志:${NC}"
        tail -20 "$LOG_FILE"
    else
        echo -e "${YELLOW}⚠️  日志文件不存在${NC}"
    fi
}

# 使用帮助
usage() {
    print_banner
    echo "用法: $0 {start|stop|restart|status|log}"
    echo ""
    echo "  start    启动服务"
    echo "  stop     停止服务"
    echo "  restart  重启服务"
    echo "  status   查看状态"
    echo "  log      查看日志"
    echo ""
    echo "  端口: ${PORT}"
    echo "  目录: ${APP_DIR}"
    echo ""
}

# 主入口
case "$1" in
    start)
        print_banner
        do_start
        ;;
    stop)
        print_banner
        do_stop
        ;;
    restart)
        print_banner
        do_restart
        ;;
    status)
        print_banner
        do_status
        ;;
    log)
        do_log
        ;;
    *)
        usage
        exit 1
        ;;
esac

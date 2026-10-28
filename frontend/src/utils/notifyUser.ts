import { ElMessage } from 'element-plus';

type NotifyType = 'success' | 'warning' | 'info' | 'error';

/** 设计器统一系统提示：带样式、位置与时长，避免裸 Message 贴底乱排 */
export function notifyUser(type: NotifyType, message: string): void {
  ElMessage({
    type,
    message,
    duration: 2600,
    offset: 72,
    showClose: true,
    grouping: true
  });
}

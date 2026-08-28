import { Component } from 'react';
import { firebaseEnabled } from '../backend/config.js';
import { LS_KEY } from '../backend/local.js';

/* Last line of defence. A render error used to unmount the whole tree and leave
   a blank page — and because the cause was usually the saved trip data, every
   reload hit the same crash. This keeps the page readable and, crucially, gives
   the person a way to throw away the bad data without opening DevTools.

   That escape hatch only exists in demo mode, where the trips really are in
   localStorage. With a Firebase project attached they live on the server, and
   the button used to clear a key nothing was reading while promising to "đưa
   mọi chuyến đi về bản mẫu ban đầu" — a no-op dressed up as a fix. So it is
   only offered where it does something. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('SmartTrip gặp lỗi khi hiển thị:', error, info?.componentStack);
  }

  reset = () => {
    try { localStorage.removeItem(LS_KEY); } catch { /* private mode */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="st-crash" role="alert">
        <div className="st-crash-card">
          <h1>SmartTrip gặp sự cố</h1>
          <p>
            Màn hình này không hiển thị được. Bạn có thể tải lại trang
            {firebaseEnabled
              ? '. Chuyến đi của bạn nằm trên máy chủ nên không mất gì.'
              : '; nếu vẫn lỗi thì nhiều khả năng dữ liệu chuyến đi đang lưu trong máy bị hỏng và cần xoá đi.'}
          </p>
          <pre>{String(this.state.error?.message || this.state.error)}</pre>
          <div className="st-crash-actions">
            <button type="button" className={`btn ${firebaseEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
            {!firebaseEnabled && (
              <button type="button" className="btn btn-primary" onClick={this.reset}>
                Xoá dữ liệu đã lưu rồi tải lại
              </button>
            )}
          </div>
          <p className="st-fineprint">
            {firebaseEnabled
              ? 'Nếu tải lại vẫn lỗi thì đây là lỗi hiển thị, không phải dữ liệu của bạn — chụp lại dòng lỗi ở trên giúp mình.'
              : 'Xoá dữ liệu sẽ đưa mọi chuyến đi về bản mẫu ban đầu. Thao tác này không thể hoàn tác.'}
          </p>
        </div>
      </div>
    );
  }
}

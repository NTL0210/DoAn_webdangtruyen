4.1. Các chức năng cơ bản
Module	Số chức năng	Mô tả chức năng
Auth	4	register, login, submitAccountAppeal, logout
Content	14	createStory, createArtwork, get, getHomeFeed, search, update, delete, getTrending, getPopularCreators, getRecommendedTags, getTrendingTags, getTagDirectory, toggleLike, toggleBookmark
Comment	3	createComment, deleteComment, getComments
Moderation	13	dismissReports, banContent, getUsersForModeration, banUser, permanentlyBanUser, unbanUser, getAccountAppeals, approveAccountAppeal, rejectAccountAppeal, getReports, openReportIncident, releaseReportIncident, getReportDetails
Notification	3	getNotifications, markAsRead, deleteNotification
Report	1	createReport
User	14	getProfile, updateProfile, updateAvatar, getFavoriteTags, addFavoriteTag, removeFavoriteTag, followUser, unfollowUser, getFollowers, getFollowing, getReadingHistory, searchCreators, getBookmarkedContent, getLikedContent
4.2. Mô tả các chức năng
-	Auth:
o	register: Đăng ký tài khoản mới với username, email, mật khẩu; kiểm tra trùng lặp; mã hóa mật khẩu; lưu vào database với role 'user'
o	login: Đăng nhập với email, mật khẩu; kiểm tra tài khoản; tạo JWT token 7 ngày nếu hợp lệ; xử lý tài khoản bị cấm; kiểm tra login notice
o	submitAccountAppeal: Gửi yêu cầu appeal cho tài khoản bị cấm vĩnh viễn; cần appeal token, lý do, bằng chứng; kiểm tra token và trạng thái; lưu appeal và thông báo admin
o	logout: Đăng xuất; client xóa token; trả về thông báo thành công
-	Content:
o	createStory: Tạo bài viết (story) với tiêu đề, mô tả, nội dung, hashtag, trạng thái, ảnh tùy chọn; parse hashtag; upload ảnh; lưu với tác giả
o	createArtwork: Tạo tác phẩm hình ảnh (artwork) với tiêu đề, mô tả, trạng thái, ảnh bắt buộc, hashtag; yêu cầu ít nhất 1 ảnh; parse hashtag; upload ảnh; lưu với tác giả
o	get: Xem chi tiết nội dung (story/artwork) theo ID; kiểm tra quyền truy cập (deleted chỉ admin, draft/pending chỉ owner/admin, approved cho tất cả); tăng views; cập nhật reading history
o	getHomeFeed: Lấy home feed với tùy chọn sort (newest/trending), type (story/artwork/all), query, tag, pagination
o	search: Tìm kiếm nội dung theo từ khóa, hashtag, loại; phân trang 50/trang; sắp xếp mới nhất; quyền admin xem draft/pending
o	update: Cập nhật nội dung (tiêu đề, mô tả, hashtag, trạng thái); kiểm tra ownership; validate dữ liệu; lưu thay đổi
o	delete: Xóa nội dung (soft delete); kiểm tra ownership; set status 'deleted'; dọn dẹp likes/bookmarks
o	getTrending: Lấy nội dung hot từ 30 ngày gần đây; tính điểm comments/(ngày+1); sắp xếp cao xuống; top 20
o	getPopularCreators: Lấy danh sách creators phổ biến
o	getRecommendedTags: Lấy tags được đề xuất dựa trên favorite tags của user
o	toggleLike: Like hoặc bỏ like nội dung; kiểm tra trạng thái; cập nhật counter; lưu database
o	toggleBookmark: Bookmark hoặc bỏ bookmark nội dung; kiểm tra trạng thái; cập nhật counter; lưu database
o	getTrendingTags: Lấy top hashtag trending theo số lượng sử dụng gần đây; sắp xếp theo phổ biến
o	getTagDirectory: Lấy danh sách tất cả hashtag; phân trang; sắp xếp alphabet/phổ biến
-	Comment:
o	createComment: Tạo bình luận cho content (story/artwork); kiểm tra content approved; lưu database; thông báo owner nếu khác user
o	deleteComment: Xóa bình luận của chính mình; kiểm tra ownership; xóa database
o	getComments: Lấy danh sách bình luận của content; sắp xếp mới nhất; kèm username/avatar
-	Moderation:
o	dismissReports: Bác bỏ báo cáo; set status 'approved'; xóa reports; thông báo owner
o	banContent: Cấm nội dung; set status 'banned'; xóa reports; thông báo owner
o	getUsersForModeration: Lấy danh sách user với số content; kèm thông tin posting restriction
o	banUser: Cấm user tạm thời (7 ngày); lý do; kiểm tra không cấm admin/tự cấm; thông báo user
o	permanentlyBanUser: Cấm user vĩnh viễn; set accountStatus 'permanently-banned'; reject pending appeals; thông báo user
o	unbanUser: Bỏ cấm user; reset trạng thái; xóa restriction history; thông báo user
o	getAccountAppeals: Lấy danh sách appeals pending; kèm user info, reason, evidence; chỉ admin
o	approveAccountAppeal: Duyệt appeal; kiểm tra pending; unban user; xóa appeal; thông báo user
o	rejectAccountAppeal: Từ chối appeal; kiểm tra pending; giữ ban; cập nhật reject reason; thông báo user
o	getReports: Lấy danh sách reports chưa xử lý; kèm content info, reason, reporter; chỉ admin
o	openReportIncident: Mở incident cho report; đánh dấu processing; thông báo admins
o	releaseReportIncident: Đóng incident; cập nhật result; thông báo users
o	getReportDetails: Lấy chi tiết report cụ thể; kèm history, evidence; chỉ admin
-	Notification:
o	getNotifications: Lấy 50 notifications gần nhất; sắp xếp mới nhất; kèm sender info
o	markAsRead: Đánh dấu notification đã đọc
o	deleteNotification: Xóa notification; kiểm tra ownership
-	Report:
o	createReport: Gửi báo cáo cho content (story/artwork); kiểm tra tồn tại/chưa report; tự động pending nếu 3+ reports; lưu database
-	User:
o	getProfile: Lấy thông tin user (username, email, avatar, bio); content của user (tất cả nếu owner, approved nếu khác); đếm followers/following; kiểm tra follow status
o	updateProfile: Cập nhật username, email, bio; kiểm tra trùng; lưu database
o	updateAvatar: Cập nhật ảnh đại diện; upload file/URL; lưu path
o	getFavoriteTags: Lấy danh sách favorite hashtags của user
o	addFavoriteTag: Thêm hashtag vào danh sách favorite của user
o	removeFavoriteTag: Xóa hashtag khỏi danh sách favorite của user
o	followUser: Follow user khác; kiểm tra tồn tại/không tự follow/chưa follow; tạo relationship; thông báo
o	unfollowUser: Unfollow user; xóa relationship
o	getFollowers: Lấy danh sách followers; kèm username/avatar/bio
o	getFollowing: Lấy danh sách following; kèm username/avatar/bio
o	getReadingHistory: Lấy top 100 content đọc gần nhất; dùng cho gợi ý/tiếp tục đọc
o	searchCreators: Tìm kiếm user theo keyword (username/bio); phân trang; sắp xếp liên quan
o	getBookmarkedContent: Lấy content đã bookmark; sắp xếp mới nhất
o	getLikedContent: Lấy content đã like; sắp xếp mới nhất
4.3. Các chức năng nâng cao
-	JWT 7 ngày + Appeal token 30 phút cho tài khoản bị cấm
-	Soft delete (không xóa hẳn, chỉ set status)
-	Real-time WebSocket notifications
-	Cấm tạm 7 ngày + cấm vĩnh viễn
-	Reading history (top 100)
-	AI-Powered Content Recommendations (ContentController): Mở rộng getRecommendedTags và getHomeFeed với thuật toán machine learning phân tích reading history (từ getReadingHistory) và favorite tags (từ getFavoriteTags), gợi ý nội dung cá nhân hóa với độ chính xác cao
-	Advanced Semantic Search (ContentController): Nâng cấp searchContent với tìm kiếm hiểu ngữ cảnh (semantic matching), hỗ trợ tìm kiếm bằng hình ảnh (image-to-text) và bộ lọc nâng cao theo tác giả, thời gian, độ phổ biến
-	Gamification System (UserController): Thêm hệ thống điểm thưởng, huy hiệu (badges) trong getProfile và updateProfile, dựa trên hoạt động như tạo nội dung (createStory/createArtwork), tương tác (toggleLike/toggleBookmark), và đóng góp cộng đồng
-	Collaborative Writing Features (ContentController): Mở rộng updateContent cho phép nhiều người dùng hợp tác viết/chỉnh sửa story với version control, bình luận thời gian thực (từ CommentController), và quyền truy cập phân cấp
-	User Analytics Dashboard (UserController): Nâng cấp getProfile với thống kê cá nhân như số lượng nội dung đã tạo, lượt xem, tương tác, và xu hướng đọc; cho admin mở rộng getUsersForModeration với báo cáo tổng quan
-	Automated AI Content Moderation (ModerationController): Tích hợp AI vào banContent và getReports để tự động phát hiện và gắn cờ nội dung vi phạm (spam, toxic language) dựa trên comments (từ getComments) và reports (từ createReport)
-	Offline Reading Mode (ContentController): Mở rộng getContent để hỗ trợ tải nội dung (stories/artworks) về thiết bị, đồng bộ hóa tiến độ đọc và bookmark khi có kết nối
-	Social Sharing Integration (ContentController): Thêm chức năng chia sẻ nội dung từ getContent lên mạng xã hội với preview tùy chỉnh, theo dõi số lượt chia sẻ từ bên ngoài
-	Personalized UI Themes and Customization (UserController): Mở rộng updateProfile để lưu trữ sở thích giao diện (theme, font), tích hợp với frontend để tùy chỉnh cá nhân
-	Premium Content Features (ContentController & AuthController): Thêm hệ thống nội dung trả phí trong createStory/createArtwork, với thanh toán tích hợp và kiểm tra quyền truy cập trong getContent
-	Social Login and Two-Factor Authentication (AuthController): Mở rộng register/login với đăng nhập qua Google/Facebook, và 2FA để tăng bảo mật
-	Threaded Comments with Mentions (CommentController): Nâng cấp createComment và getComments với hệ thống bình luận lồng nhau, hỗ trợ mention (@username) và thông báo real-time (từ NotificationController)
-	Advanced Moderation Tools (ModerationController): Mở rộng getReports và openReportIncident với dashboard quản lý incidents, bulk actions, và analytics về moderation activities

export const limitPagination = (page: number, limit: number) => {
    return (page - 1) * limit;
}
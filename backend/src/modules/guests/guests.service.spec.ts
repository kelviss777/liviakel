import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { GuestGroup } from './guests.types';
import { GuestsService } from './guests.service';

describe('GuestsService', () => {
  it('usa wedding_id resolvido no servidor', async () => {
    const repository = { create: jest.fn().mockResolvedValue({ id: 'guest' }) };
    const context = {
      resolve: jest.fn().mockResolvedValue({ id: 'wedding-server', role: 'owner' }),
    };
    const service = new GuestsService(repository as never, context as never);
    const request = { accessToken: 'token', user: { id: 'user' } } as AuthenticatedRequest;
    await service.create(request, { name: 'Ana', guest_group: GuestGroup.Family });
    expect(repository.create).toHaveBeenCalledWith(
      'wedding-server',
      'token',
      expect.not.objectContaining({ wedding_id: expect.anything() }),
    );
  });
});
